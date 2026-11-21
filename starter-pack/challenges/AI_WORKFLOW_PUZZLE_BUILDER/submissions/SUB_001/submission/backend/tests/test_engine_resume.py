"""Resuming a failed run from its last successful step, plus store behaviour."""

from __future__ import annotations

import pytest
from conftest import FakeModelPort, FakeToolPort, ScriptedInjector, events_of, node, workflow

from app.engine.errors import RunNotFound
from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan
from app.engine.run import RunStatus
from app.engine.store import InMemoryRunStore
from app.engine.trace import EventType, StepStatus

TOOL_ERROR = FailurePlan(kind=FailureKind.TOOL_ERROR, detail={"message": "CRM is down"})


def mission_workflow():
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Plan the mission", output_field="plan"),
            node("dispatch", BlockType.TOOL, tool="crm", output_field="ticket"),
            node("output", BlockType.OUTPUT),
        ]
    )


async def interrupted_run():
    injector = ScriptedInjector({("dispatch", 1): TOOL_ERROR})
    model = FakeModelPort("step 1, step 2")
    tool = FakeToolPort(result={"ticket_id": "T-9"})
    executor = WorkflowExecutor(model=model, tool=tool, injector=injector)
    state = await executor.start_run(mission_workflow(), {"mission": "launch"})
    return executor, state, model, tool, injector


async def test_a_failed_run_records_where_it_stopped():
    _, state, _, tool, _ = await interrupted_run()

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "tool_error"
    assert state.snapshots["ai"].status is StepStatus.COMPLETED
    assert state.snapshots["dispatch"].status is StepStatus.FAILED
    assert tool.call_count == 0


async def test_resume_from_last_successful_skips_completed_steps():
    executor, failed, model, tool, injector = await interrupted_run()
    injector.enabled = False

    resumed = await executor.resume_from_last_successful(failed.run_id)

    assert resumed.run_id != failed.run_id
    assert resumed.resumed_from == failed.run_id
    assert resumed.status is RunStatus.COMPLETED
    assert resumed.result == {
        "mission": "launch",
        "plan": "step 1, step 2",
        "ticket": {"ticket_id": "T-9"},
    }
    # The reused steps are replayed as `skipped` and never executed again.
    skipped = {event.node_id for event in events_of(resumed, EventType.STEP_SKIPPED)}
    assert skipped == {"input", "ai"}
    assert resumed.snapshots["input"].status is StepStatus.SKIPPED
    assert resumed.snapshots["ai"].status is StepStatus.SKIPPED
    assert resumed.snapshots["ai"].reused_from == failed.run_id
    assert model.call_count == 1
    assert tool.call_count == 1
    assert resumed.snapshots["dispatch"].status is StepStatus.COMPLETED
    # The original run is left untouched as a record of what happened.
    assert executor.store.get(failed.run_id).status is RunStatus.FAILED


async def test_resume_reuses_the_stored_snapshot_as_its_starting_data():
    executor, failed, _, _, injector = await interrupted_run()
    injector.enabled = False

    resumed = await executor.resume_from_last_successful(failed.run_id)

    started = events_of(resumed, EventType.RUN_STARTED)[0]
    assert started.payload["resumed_from"] == failed.run_id
    assert started.payload["resume_after_node_id"] == "ai"
    assert resumed.snapshots["dispatch"].input == failed.snapshots["ai"].output


async def test_resume_restarts_from_the_beginning_when_nothing_succeeded():
    injector = ScriptedInjector(
        {("input", 1): FailurePlan(kind=FailureKind.MODEL_ERROR, detail={"message": "boom"})}
    )
    executor = WorkflowExecutor(model=FakeModelPort("plan"), tool=FakeToolPort({}), injector=injector)
    failed = await executor.start_run(mission_workflow(), {"mission": "launch"})
    assert failed.status is RunStatus.FAILED
    injector.enabled = False

    resumed = await executor.resume_from_last_successful(failed.run_id)

    assert resumed.status is RunStatus.COMPLETED
    assert events_of(resumed, EventType.STEP_SKIPPED) == []
    assert resumed.snapshots["input"].status is StepStatus.COMPLETED


async def test_resume_after_a_condition_re_runs_the_condition():
    from conftest import edge

    injector = ScriptedInjector({("dispatch", 1): TOOL_ERROR})
    tool = FakeToolPort(result={"ticket_id": "T-1"})
    executor = WorkflowExecutor(tool=tool, injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("check", BlockType.CONDITION, field="mission", operator="exists"),
            node("dispatch", BlockType.TOOL, tool="crm", output_field="ticket"),
            node("output", BlockType.OUTPUT),
            node("stop", BlockType.SAFE_STOP),
        ],
        edges=[
            edge("input", "check"),
            edge("check", "dispatch", "true"),
            edge("check", "stop", "false"),
            edge("dispatch", "output"),
        ],
    )
    failed = await executor.start_run(graph, {"mission": "launch"})
    injector.enabled = False

    resumed = await executor.resume_from_last_successful(failed.run_id)

    assert resumed.status is RunStatus.COMPLETED
    assert resumed.snapshots["check"].status is StepStatus.COMPLETED
    assert {event.node_id for event in events_of(resumed, EventType.STEP_SKIPPED)} == {"input"}


async def test_the_store_hands_out_one_queue_per_run_carrying_every_event():
    store = InMemoryRunStore()
    executor = WorkflowExecutor(store, model=FakeModelPort("summary"))

    state = await executor.start_run(
        workflow(
            [
                node("input", BlockType.INPUT),
                node("ai", BlockType.AI_MODEL, output_field="summary"),
                node("output", BlockType.OUTPUT),
            ]
        ),
        {"text": "hi"},
    )

    queued = store.drain(state.run_id)
    assert [event.seq for event in queued] == [event.seq for event in state.trace]
    assert store.drain(state.run_id) == []


def test_an_unknown_run_id_raises():
    with pytest.raises(RunNotFound):
        InMemoryRunStore().get("nope")
