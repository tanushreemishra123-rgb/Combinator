"""Per-run execution context and the process-wide run registry.

Responsibility: everything the stateless HTTP handlers cannot hold themselves -
which puzzle a run belongs to, which ports and failure injector it was started
with, whether its scenario was actually staged, and the background task that is
executing it.

Three things live here that the engine deliberately does not know about:

* **``puzzle_id``** - ``RunState`` has no idea which puzzle it is playing, so the
  registry remembers it and :class:`~app.api.schemas.RunSummary` merges it in.
* **The resumed context** - "resume from the last successful step" means *the
  outage has passed*, so the clone runs against the same fixtures with the
  injector switched off. That is only possible because the source run's context
  is still here.
* **A crash guard** - a background run that dies for a non-engine reason is
  written into the trace as ``run_failed`` rather than hanging forever in
  ``running``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Coroutine
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from app.engine.errors import StepExecutionError, WorkflowValidationError
from app.engine.executor import WorkflowExecutor
from app.engine.ports import FailureInjector
from app.engine.run import RunState, RunStatus
from app.engine.store import InMemoryRunStore
from app.engine.trace import EventType, StepStatus, TraceRecorder, utcnow
from app.failures.injector import off
from app.providers import ProviderSettings, build_model_port
from app.puzzles.models import Puzzle
from app.puzzles.registry import puzzle_injector, puzzle_ports
from app.tools.retrieval import FixtureRetrieval
from app.tools.simulator import SimulatedToolbox


def new_run_id() -> str:
    """A fresh run id, minted *before* execution starts so ``202`` can return it."""
    return f"run_{uuid4().hex[:12]}"


class ApiRunStore(InMemoryRunStore):
    """The engine's store plus a way to choose a resume clone's id up front.

    ``WorkflowExecutor.resume_from_last_successful`` mints the clone's id inside
    :meth:`InMemoryRunStore.clone_for_resume`, but ``POST /runs/{id}/resume-last``
    has to answer ``202 {run_id}`` *before* the resume executes. Reserving the id
    against the source run keeps that promise without touching the engine.
    """

    def __init__(self) -> None:
        super().__init__()
        self._reserved: dict[str, list[str]] = {}

    def reserve_clone_id(self, source_run_id: str, clone_run_id: str) -> str:
        self._reserved.setdefault(source_run_id, []).append(clone_run_id)
        return clone_run_id

    def clone_for_resume(self, run_id: str, new_run_id: str | None = None) -> RunState:
        if new_run_id is None:
            reserved = self._reserved.get(run_id)
            if reserved:
                new_run_id = reserved.pop(0)
        return super().clone_for_resume(run_id, new_run_id)


@dataclass(slots=True)
class RunContext:
    """One run's puzzle, ports and background task."""

    run_id: str
    executor: WorkflowExecutor
    puzzle: Puzzle | None = None
    scenario_id: str | None = None
    #: Whether a failure scenario was really staged (drives the reliability report).
    scenario_enabled: bool = False
    injector: FailureInjector | None = None
    task: asyncio.Task[Any] | None = None
    #: True between accepting a review decision and the resume actually running,
    #: so the SSE stream does not report the run as still paused and hang up.
    resuming: bool = False

    @property
    def puzzle_id(self) -> str | None:
        return self.puzzle.id if self.puzzle else None


class RunRegistry:
    """The process-wide set of runs, their contexts and the shared run store."""

    def __init__(self, store: ApiRunStore | None = None) -> None:
        self.store = store or ApiRunStore()
        self._contexts: dict[str, RunContext] = {}

    # ------------------------------------------------------------- contexts

    def find(self, run_id: str) -> RunContext | None:
        return self._contexts.get(run_id)

    def register(self, context: RunContext) -> RunContext:
        self._contexts[context.run_id] = context
        return context

    def state(self, run_id: str) -> RunState | None:
        return self.store.find(run_id)

    # ---------------------------------------------------------------- ports

    def build_executor(
        self, puzzle: Puzzle | None, scenario_id: str | None
    ) -> tuple[WorkflowExecutor, FailureInjector]:
        """An executor over the shared store, wired to this puzzle's fixtures.

        With a puzzle, the model port is built through ``ProviderSettings`` so a
        configured live provider (Groq or Gemini) runs live while the
        puzzle's committed answers stay available as the mock fallback. Without
        one, the run gets the environment's default provider and empty
        tool/retrieval fixtures.
        """
        if puzzle is None:
            settings = ProviderSettings.from_env()
            executor = WorkflowExecutor(
                store=self.store,
                model=build_model_port(settings),
                tool=SimulatedToolbox(),
                retrieval=FixtureRetrieval(),
                injector=off(),
            )
            return executor, off()

        fixtures = puzzle_ports(puzzle)
        settings = ProviderSettings.from_env(
            responses=fixtures.responses,
            responses_by_provider=fixtures.responses_by_provider,
        )
        injector = puzzle_injector(puzzle, scenario_id)
        executor = WorkflowExecutor(
            store=self.store,
            model=build_model_port(settings),
            tool=fixtures.toolbox(),
            retrieval=fixtures.retrieval(),
            injector=injector,
        )
        return executor, injector

    def resumed_executor(self, context: RunContext) -> WorkflowExecutor:
        """A twin of ``context``'s executor with nothing staged to fail.

        This is what "the outage has passed" means: same store, same fixtures,
        the injector switched off so the replayed steps get an honest chance.
        """
        executor, _ = self.build_executor(context.puzzle, None)
        return executor

    # ----------------------------------------------------------- background

    def launch(
        self,
        context: RunContext,
        work: Callable[[], Coroutine[Any, Any, Any]],
    ) -> RunContext:
        """Register ``context`` and run ``work`` as a guarded background task."""
        self.register(context)
        context.task = asyncio.create_task(self._guarded(context, work()))
        return context

    async def _guarded(self, context: RunContext, work: Awaitable[Any]) -> None:
        """Await ``work``, turning any escape into a recorded ``run_failed``."""
        try:
            await work
        except asyncio.CancelledError:  # pragma: no cover - shutdown only
            raise
        except BaseException as exc:  # noqa: BLE001 - a crash must reach the trace
            self.mark_failed(context.run_id, exc)
        finally:
            context.resuming = False

    def mark_failed(self, run_id: str, exc: BaseException) -> None:
        """End a run that crashed outside the engine's own error handling.

        The engine already writes ``run_failed`` for every failure it understands;
        this only fires for what escapes it (an unrunnable graph, a bug), so a
        crashed run is never left sitting in ``running`` with nothing streaming.
        """
        state = self.store.find(run_id)
        if state is None or state.is_finished:  # nosemgrep: python.lang.maintainability.is-function-without-parentheses.is-function-without-parentheses -- property access on RunState, not a missed call
            return
        payload = _error_payload(exc)
        state.status = RunStatus.FAILED
        state.error = payload
        state.pending_review = None
        state.finished_at = utcnow()
        recorder = TraceRecorder(run_id, state.trace, self.store.queue(run_id))
        recorder.emit(
            EventType.RUN_FAILED,
            node_id=state.current_node,
            status=StepStatus.FAILED,
            payload={"error": payload, "failed_node_id": state.current_node},
        )
        self.store.save(state)


def _error_payload(exc: BaseException) -> dict[str, Any]:
    """A trace-shaped ``{kind, message, detail?}`` block for any exception."""
    if isinstance(exc, StepExecutionError):
        return exc.to_payload()
    if isinstance(exc, WorkflowValidationError):
        return {
            "kind": "workflow_invalid",
            "message": str(exc),
            "detail": {
                "errors": [issue.model_dump() for issue in exc.report.errors]
            },
        }
    return {
        "kind": "internal_error",
        "message": str(exc) or type(exc).__name__,
        "detail": {"exception": type(exc).__name__},
    }


#: One-line blurbs for the simulated toolbox, kept here so ``app/tools`` stays a
#: pure capability layer with no UI copy in it.
TOOL_DESCRIPTIONS: dict[str, str] = {
    "knowledge_search": "Search the knowledge base and return matching documents.",
    "ticket_lookup": "Look up a support ticket's priority, product area and status.",
    "send_message": "Deliver a message to a channel or address (simulated).",
    "web_fetch": "Fetch the contents of a research source or page.",
    "calculator": "Do safe arithmetic over a numeric field (sum, mean, min, max...).",
}


def tool_catalogue() -> list[dict[str, str]]:
    """Every tool a Tool block may call, with a one-line description each."""
    return [
        {
            "name": name,
            "description": TOOL_DESCRIPTIONS.get(
                name, f"Simulated {name.replace('_', ' ')} tool."
            ),
        }
        for name in SimulatedToolbox().tool_names
    ]
