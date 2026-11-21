"""Run persistence.

Responsibility: hold run state for the lifetime of the process, hand out one live
event queue per run (consumed by the SSE endpoint in Task 5), and build the
"resume from the last successful step" clone that Puzzle 8 is built on.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterable
from typing import Any

from app.engine.errors import RunNotFound
from app.engine.model import GUARD_TYPES, BlockType, WorkflowDef
from app.engine.run import RunState, RunStatus, StepSnapshot
from app.engine.trace import StepStatus, TraceEvent, utcnow

SUCCESSFUL_STATUSES: frozenset[StepStatus] = frozenset(
    {StepStatus.COMPLETED, StepStatus.RECOVERED, StepStatus.SKIPPED}
)

#: Steps whose outcome cannot be reused verbatim when resuming: guards are
#: re-derived from the chain and conditions are pure, so both are simply re-run.
NON_ANCHOR_TYPES: frozenset[BlockType] = GUARD_TYPES | {BlockType.CONDITION}


class InMemoryRunStore:
    """A process-local store of runs plus their live trace queues."""

    def __init__(self) -> None:
        self._runs: dict[str, RunState] = {}
        self._queues: dict[str, asyncio.Queue[TraceEvent]] = {}

    # ----------------------------------------------------------------- runs

    def create(
        self,
        workflow: WorkflowDef,
        sample_input: Any = None,
        *,
        scenario_id: str | None = None,
        run_id: str | None = None,
    ) -> RunState:
        """Register a new run in the ``running`` state."""
        run_id = run_id or f"run_{uuid.uuid4().hex[:12]}"
        state = RunState(
            run_id=run_id,
            workflow=workflow,
            status=RunStatus.RUNNING,
            input=sample_input,
            data=sample_input,
            scenario_id=scenario_id,
        )
        self._runs[run_id] = state
        self._queues[run_id] = asyncio.Queue()
        return state

    def get(self, run_id: str) -> RunState:
        """Return the run or raise :class:`RunNotFound`."""
        try:
            return self._runs[run_id]
        except KeyError as exc:
            raise RunNotFound(f"Unknown run id: {run_id!r}") from exc

    def find(self, run_id: str) -> RunState | None:
        return self._runs.get(run_id)

    def save(self, state: RunState) -> RunState:
        """Persist ``state`` (a no-op for in-memory storage beyond the timestamp)."""
        state.updated_at = utcnow()
        self._runs[state.run_id] = state
        return state

    def list_runs(self) -> list[RunState]:
        return list(self._runs.values())

    # --------------------------------------------------------------- events

    def queue(self, run_id: str) -> asyncio.Queue[TraceEvent]:
        """The live event queue for ``run_id``, created on demand."""
        if run_id not in self._queues:
            self._queues[run_id] = asyncio.Queue()
        return self._queues[run_id]

    def drain(self, run_id: str) -> list[TraceEvent]:
        """Pop every queued event (test/inspection helper)."""
        queue = self.queue(run_id)
        events: list[TraceEvent] = []
        while not queue.empty():
            events.append(queue.get_nowait())
        return events

    def discard(self, run_id: str) -> None:
        """Forget a run's queue once nothing is streaming it."""
        self._queues.pop(run_id, None)

    # --------------------------------------------------------------- resume

    def resume_anchor(self, state: RunState) -> str | None:
        """Id of the last step whose stored output can be reused on resume.

        Guards and conditions are never anchors: guards are re-derived from the
        chain and conditions are pure, so re-running them is free and keeps
        branch routing correct.
        """
        for node_id in reversed(state.step_order):
            snapshot = state.snapshots[node_id]
            if snapshot.status not in SUCCESSFUL_STATUSES:
                continue
            if snapshot.node_type in NON_ANCHOR_TYPES:
                continue
            return node_id
        return None

    def clone_for_resume(self, run_id: str, new_run_id: str | None = None) -> RunState:
        """Clone a finished run, reusing every snapshot up to the resume anchor.

        The clone starts empty of trace events; the executor emits the
        ``step_skipped`` events describing what was reused.
        """
        source = self.get(run_id)
        anchor = self.resume_anchor(source)
        clone = RunState(
            run_id=new_run_id or f"run_{uuid.uuid4().hex[:12]}",
            workflow=source.workflow,
            status=RunStatus.RUNNING,
            input=source.input,
            data=source.input,
            scenario_id=source.scenario_id,
            resumed_from=source.run_id,
        )
        for snapshot in _reusable(source, anchor):
            clone.record(
                snapshot.model_copy(
                    update={
                        "status": StepStatus.SKIPPED,
                        "reused_from": source.run_id,
                    }
                )
            )
        self._runs[clone.run_id] = clone
        self._queues[clone.run_id] = asyncio.Queue()
        return clone


def _reusable(state: RunState, anchor: str | None) -> Iterable[StepSnapshot]:
    """Successful snapshots from the start of the run up to and including ``anchor``."""
    if anchor is None:
        return []
    reusable: list[StepSnapshot] = []
    for node_id in state.step_order:
        snapshot = state.snapshots[node_id]
        if snapshot.status in SUCCESSFUL_STATUSES:
            reusable.append(snapshot)
        if node_id == anchor:
            break
    return reusable
