"""Trace completeness: a run must be fully reconstructable from its events alone."""

from __future__ import annotations

import json

from conftest import (
    FakeModelPort,
    ScriptedInjector,
    edge,
    events_of,
    io_from_trace,
    node,
    statuses_from_trace,
    workflow,
)

from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan
from app.engine.run import RunStatus
from app.engine.trace import EventType


def rich_workflow():
    """A graph that exercises guards, validation, branching and a safe stop."""
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("retry", BlockType.RETRY, max_attempts=2, delay_ms=0),
            node("timeout", BlockType.TIMEOUT, timeout_ms=1000),
            node("ai", BlockType.AI_MODEL, prompt="Route"),
            node(
                "validate",
                BlockType.VALIDATOR,
                schema={"owner": {"type": "string"}},
                on_fail="safe_default",
                safe_default={"owner": "unassigned", "category": "support"},
            ),
            node("check", BlockType.CONDITION, field="owner", operator="ne", value="unassigned"),
            node("output", BlockType.OUTPUT),
            node("stop", BlockType.SAFE_STOP, message="No owner could be assigned."),
        ],
        edges=[
            edge("input", "retry"),
            edge("retry", "timeout"),
            edge("timeout", "ai"),
            edge("ai", "validate"),
            edge("validate", "check"),
            edge("check", "output", "true"),
            edge("check", "stop", "false"),
        ],
    )


async def rich_run():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.MODEL_ERROR, detail={"message": "flaky"})}
    )
    executor = WorkflowExecutor(model=FakeModelPort({"category": "support"}), injector=injector)
    return await executor.start_run(rich_workflow(), {"ticket": "T-1"}, scenario_id="demo")


async def test_sequence_numbers_are_strictly_increasing_from_one():
    state = await rich_run()

    assert [event.seq for event in state.trace] == list(range(1, len(state.trace) + 1))


async def test_every_step_status_is_reconstructable_from_the_trace():
    state = await rich_run()

    from_trace = statuses_from_trace(state)
    from_snapshots = {
        node_id: snapshot.status.value for node_id, snapshot in state.snapshots.items()
    }
    assert from_trace == from_snapshots


async def test_every_step_input_and_output_is_reconstructable_from_the_trace():
    state = await rich_run()

    reconstructed = io_from_trace(state)
    for node_id, snapshot in state.snapshots.items():
        if snapshot.node_type.value in {"retry", "timeout", "fallback"}:
            continue  # guards record what they did, not workflow data
        assert reconstructed[node_id]["input"] == snapshot.input
        assert reconstructed[node_id]["output"] == snapshot.output


async def test_every_executed_step_has_a_start_and_an_end_event():
    state = await rich_run()

    for node_id in state.step_order:
        assert events_of(state, EventType.STEP_STARTED, node_id), node_id
        endings = [
            event
            for event in state.trace
            if event.node_id == node_id
            and event.event
            in {
                EventType.STEP_COMPLETED,
                EventType.STEP_FAILED,
                EventType.STEP_RECOVERED,
                EventType.REVIEW_REQUESTED,
            }
        ]
        assert endings, node_id


async def test_the_trace_is_json_serialisable_end_to_end():
    state = await rich_run()

    encoded = json.dumps([event.model_dump(mode="json") for event in state.trace])
    decoded = json.loads(encoded)
    assert decoded[0]["event"] == "run_started"
    assert decoded[0]["payload"]["scenario_id"] == "demo"
    assert decoded[-1]["event"] in {"run_completed", "run_safe_stopped", "run_failed"}


async def test_the_run_narrative_reads_in_order():
    state = await rich_run()

    assert state.status is RunStatus.SAFELY_STOPPED
    story = [(event.event.value, event.node_id) for event in state.trace]
    assert story[0] == ("run_started", None)
    assert ("step_retrying", "ai") in story
    assert ("step_recovered", "ai") in story
    assert ("validation_result", "validate") in story
    assert ("step_recovered", "validate") in story
    assert story[-1] == ("run_safe_stopped", "stop")


async def test_attempt_numbers_appear_on_every_attempt_event():
    state = await rich_run()

    attempts = [event.payload["attempt"] for event in events_of(state, EventType.STEP_STARTED, "ai")]
    assert attempts == [1, 2]
    recovered = events_of(state, EventType.STEP_RECOVERED, "ai")[0]
    assert recovered.payload["attempt"] == 2
    assert recovered.payload["recovery_action"] == "retry"
