"""Run lifecycle routes: start, stream, inspect, review, resume, score.

Responsibility: turn the engine's in-process run lifecycle into the HTTP surface
the frontend drives. Three things are worth knowing before reading the code.

**Nothing blocks the request.** ``POST /runs`` mints the run id, registers the
run in the store and hands execution to a background task, so ``202`` comes back
before the first block runs. The same is true of a review decision and of a
resume.

**The SSE stream is reconnect-safe.** It never reads the store's live queue -
a queue can only be drained once, so a reconnecting client would lose whatever
the previous consumer took. Instead it walks ``state.trace`` by index, replaying
from seq 1 on every connection and then following the list as it grows
(:data:`POLL_INTERVAL_S`). Reconnecting mid-run therefore replays the identical
prefix and then continues with no gaps and no duplicates.

**A paused run is not a finished run.** The stream closes on ``paused`` so the
UI can put up the review modal, and the client re-opens it after deciding.
Between accepting the decision and the resume task actually starting, the run is
still ``paused`` in the store - :attr:`RunContext.resuming` covers that window so
a fast client does not get told "paused" a second time and stop listening.
"""

from __future__ import annotations

import asyncio
import copy
import time
from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from app.api.context import RunContext, RunRegistry, new_run_id
from app.api.deps import RegistryDep
from app.api.schemas import (
    ReviewDecisionRequest,
    RunAccepted,
    RunRequest,
    RunSummary,
)
from app.engine.run import TERMINAL_RUN_STATUSES, ReviewDecision, RunState, RunStatus
from app.puzzles.models import Puzzle
from app.puzzles.registry import PuzzleNotFound, get_puzzle
from app.reliability.scorer import ReliabilityReport, score_run

#: How often the SSE stream looks for new trace events. Small enough that the
#: canvas feels live, large enough that an idle stream costs nothing.
POLL_INTERVAL_S = 0.05

#: Seconds between keep-alive comments, so proxies do not close a quiet stream.
PING_INTERVAL_S = 15.0

router = APIRouter(prefix="/api/runs", tags=["runs"])


# ------------------------------------------------------------------ helpers


def get_run_context(run_id: str, registry: RegistryDep) -> RunContext:
    """The registered context for ``run_id``, or a 404.

    Declared as a dependency rather than inline so the SSE endpoint can answer
    404 *before* it starts streaming a response body.
    """
    context = registry.find(run_id)
    if context is None:
        raise HTTPException(status_code=404, detail=f"Unknown run id: {run_id!r}.")
    return context


ContextDep = Annotated[RunContext, Depends(get_run_context)]


def _resolve_puzzle(puzzle_id: str | None) -> Puzzle | None:
    if not puzzle_id:
        return None
    try:
        return get_puzzle(puzzle_id)
    except PuzzleNotFound as exc:
        raise HTTPException(status_code=404, detail=f"No puzzle called {puzzle_id!r}.") from exc


def _require_state(registry: RunRegistry, run_id: str) -> RunState:
    state = registry.state(run_id)
    if state is None:  # pragma: no cover - the run row is created before the task
        raise HTTPException(status_code=404, detail=f"Unknown run id: {run_id!r}.")
    return state


# -------------------------------------------------------------- starting runs


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def start_run(body: RunRequest, registry: RegistryDep) -> RunAccepted:
    """Start executing a workflow and return its run id immediately.

    With a ``puzzle_id`` the run gets that puzzle's committed fixtures - canned
    model answers, tool and retrieval fixtures - and, when ``scenario_id`` names
    one of its failure scenarios, that scenario staged. Without one it runs
    against the environment's default provider and empty fixtures.
    """
    puzzle = _resolve_puzzle(body.puzzle_id)
    scenario = puzzle.scenario(body.scenario_id) if puzzle else None
    scenario_id = scenario.id if scenario else None

    executor, injector = registry.build_executor(puzzle, scenario_id)
    run_input = body.input
    if not body.input_given and puzzle is not None:
        run_input = puzzle.sample_input
    run_input = copy.deepcopy(run_input)

    run_id = new_run_id()
    # Register the run *before* the task starts, so an immediate GET or SSE
    # connect finds it - and so a crash before the engine creates it still has
    # somewhere to write ``run_failed``.
    registry.store.create(
        body.workflow, run_input, scenario_id=scenario_id, run_id=run_id
    )
    context = RunContext(
        run_id=run_id,
        executor=executor,
        puzzle=puzzle,
        scenario_id=scenario_id,
        scenario_enabled=bool(scenario and scenario.enabled),
        injector=injector,
    )
    registry.launch(
        context,
        lambda: executor.start_run(
            body.workflow, run_input, scenario_id=scenario_id, run_id=run_id
        ),
    )
    return RunAccepted(run_id=run_id)


# ------------------------------------------------------------------ reading


@router.get("/{run_id}")
async def get_run(context: ContextDep, registry: RegistryDep) -> RunSummary:
    """The run's status, result, pending review and full trace."""
    state = _require_state(registry, context.run_id)
    return RunSummary.of(state, context.puzzle_id)


@router.get("/{run_id}/reliability")
async def get_reliability(
    context: ContextDep, registry: RegistryDep
) -> ReliabilityReport:
    """Grade a finished run. A run still in flight has nothing to grade yet."""
    state = _require_state(registry, context.run_id)
    if state.status not in TERMINAL_RUN_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Run {context.run_id!r} is {state.status.value}; "
                "a reliability report needs a finished run."
            ),
        )
    return score_run(state, context.puzzle, context.scenario_enabled)


# ---------------------------------------------------------------- streaming


@router.get("/{run_id}/events", response_class=EventSourceResponse)
async def stream_events(
    context: ContextDep, registry: RegistryDep
) -> AsyncIterable[ServerSentEvent]:
    """Replay every recorded trace event, then follow the run live.

    Emits ``trace`` for each :class:`~app.engine.trace.TraceEvent` in ``seq``
    order, then exactly one terminator: ``paused`` with the run summary when the
    run stops for a human, or ``done`` with the run summary when it reaches a
    terminal status.
    """
    emitted = 0
    last_ping = time.monotonic()

    while True:
        state = registry.state(context.run_id)
        if state is None:  # pragma: no cover - the run row outlives the stream
            return
        trace = state.trace

        # Drain everything recorded so far. ``len(trace)`` is re-read each pass,
        # so events appended while this coroutine is suspended on a yield are
        # picked up before the status below is consulted.
        while emitted < len(trace):
            event = trace[emitted]
            emitted += 1
            yield ServerSentEvent(
                data=event.model_dump(mode="json"),
                event="trace",
                id=str(event.seq),
            )

        run_status = state.status
        if run_status is RunStatus.PAUSED and not context.resuming:
            yield ServerSentEvent(
                data=RunSummary.of(state, context.puzzle_id).model_dump(mode="json"),
                event="paused",
            )
            return
        if run_status in TERMINAL_RUN_STATUSES:
            yield ServerSentEvent(
                data=RunSummary.of(state, context.puzzle_id).model_dump(mode="json"),
                event="done",
            )
            return

        now = time.monotonic()
        if now - last_ping >= PING_INTERVAL_S:
            last_ping = now
            yield ServerSentEvent(comment="ping")
        await asyncio.sleep(POLL_INTERVAL_S)


# ------------------------------------------------------------------ review


@router.post("/{run_id}/review", status_code=status.HTTP_202_ACCEPTED)
async def submit_review(
    body: ReviewDecisionRequest, context: ContextDep, registry: RegistryDep
) -> RunAccepted:
    """Apply a human decision to a paused run and let it carry on."""
    state = _require_state(registry, context.run_id)
    review = state.pending_review
    if state.status is not RunStatus.PAUSED or review is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Run {context.run_id!r} is {state.status.value}, "
                "not waiting for a review."
            ),
        )
    if body.action not in review.allowed_actions:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This review does not allow {body.action!r}; "
                f"allowed: {', '.join(review.allowed_actions)}."
            ),
        )

    decision = ReviewDecision(
        action=body.action, edited_data=body.edited_data, note=body.note
    )
    context.resuming = True
    registry.launch(
        context, lambda: context.executor.resume_run(context.run_id, decision)
    )
    return RunAccepted(run_id=context.run_id)


# ------------------------------------------------------------------ resume


@router.post("/{run_id}/resume-last", status_code=status.HTTP_202_ACCEPTED)
async def resume_from_last(context: ContextDep, registry: RegistryDep) -> RunAccepted:
    """Clone a stopped run and re-run it from just after its last good step.

    The clone runs with the failure injector switched off: the point of resuming
    is that the outage has passed, so the step that broke gets a fair attempt.
    Every reused step is replayed into the new run's trace as ``step_skipped``.
    """
    source = _require_state(registry, context.run_id)
    if source.status is RunStatus.RUNNING:
        raise HTTPException(
            status_code=409,
            detail=f"Run {context.run_id!r} is still running; let it finish first.",
        )

    clone_id = registry.store.reserve_clone_id(context.run_id, new_run_id())
    executor = registry.resumed_executor(context)
    registry.store.create(
        source.workflow, source.input, scenario_id=source.scenario_id, run_id=clone_id
    )
    clone_context = RunContext(
        run_id=clone_id,
        executor=executor,
        puzzle=context.puzzle,
        scenario_id=context.scenario_id,
        # The scenario was staged for this attempt at the puzzle, so the resumed
        # run is still graded on whether the injected failure was handled.
        scenario_enabled=context.scenario_enabled,
        injector=executor.ports.injector,
    )
    registry.launch(
        clone_context,
        lambda: executor.resume_from_last_successful(context.run_id),
    )
    return RunAccepted(run_id=clone_id)


__all__ = ["router"]
