"""Human review: pausing a run, and the approve / edit / reject decisions."""

from __future__ import annotations

import pytest
from conftest import FakeModelPort, chain, events_of, node, workflow

from app.engine.errors import InvalidRunState
from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.run import ReviewDecision, RunStatus
from app.engine.trace import EventType, StepStatus


def review_workflow(with_safe_stop: bool = True):
    nodes = [
        node("input", BlockType.INPUT),
        node("ai", BlockType.AI_MODEL, prompt="Draft the reply", output_field="draft"),
        node(
            "review",
            BlockType.HUMAN_REVIEW,
            prompt="Send this reply to the customer?",
        ),
        node("output", BlockType.OUTPUT),
    ]
    edges = None
    if with_safe_stop:
        # The safe stop is only reachable through a rejection, which is a runtime
        # route rather than an edge.
        stop = node("stop", BlockType.SAFE_STOP, message="Nothing was sent.")
        edges = chain(nodes)
        nodes = [*nodes, stop]
    return workflow(nodes, edges)


async def paused_run(executor: WorkflowExecutor, with_safe_stop: bool = True):
    return await executor.start_run(
        review_workflow(with_safe_stop), {"customer": "Ada"}
    )


async def test_human_review_pauses_the_run_with_a_review_payload():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))

    state = await paused_run(executor)

    assert state.status is RunStatus.PAUSED
    assert state.current_node == "review"
    review = state.pending_review
    assert review is not None
    assert review.prompt == "Send this reply to the customer?"
    assert review.allowed_actions == ["approve", "edit", "reject"]
    assert review.data == {"customer": "Ada", "draft": "Dear Ada, ..."}
    assert review.resume_node_id == "output"
    assert state.snapshots["review"].status is StepStatus.PAUSED
    assert "output" not in state.snapshots
    requested = events_of(state, EventType.REVIEW_REQUESTED, "review")[0]
    assert requested.payload["review"]["allowed_actions"] == ["approve", "edit", "reject"]
    assert events_of(state, EventType.RUN_PAUSED)


async def test_review_approve_continues_with_the_same_data():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    state = await paused_run(executor)

    resumed = await executor.resume_run(state.run_id, {"action": "approve"})

    assert resumed.status is RunStatus.COMPLETED
    assert resumed.result == {"customer": "Ada", "draft": "Dear Ada, ..."}
    assert resumed.snapshots["review"].status is StepStatus.COMPLETED
    decision = events_of(resumed, EventType.REVIEW_DECISION, "review")[0]
    assert decision.payload["action"] == "approve"
    assert events_of(resumed, EventType.RUN_RESUMED)
    assert resumed.pending_review is None


async def test_review_edit_propagates_the_edited_data():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    state = await paused_run(executor)
    edited = {"customer": "Ada", "draft": "Hi Ada, here is the fix."}

    resumed = await executor.resume_run(
        state.run_id,
        ReviewDecision(action="edit", edited_data=edited, note="tone tweak"),
    )

    assert resumed.status is RunStatus.COMPLETED
    assert resumed.result == edited
    assert resumed.snapshots["review"].output == edited
    assert resumed.snapshots["output"].input == edited
    decision = events_of(resumed, EventType.REVIEW_DECISION, "review")[0]
    assert decision.payload["edited_data"] == edited
    assert decision.payload["data_before"]["draft"] == "Dear Ada, ..."
    assert decision.payload["note"] == "tone tweak"


async def test_review_reject_routes_to_the_safe_stop_with_the_note():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    state = await paused_run(executor)

    resumed = await executor.resume_run(
        state.run_id, {"action": "reject", "note": "Wrong customer."}
    )

    assert resumed.status is RunStatus.SAFELY_STOPPED
    assert resumed.snapshots["stop"].status is StepStatus.SAFELY_STOPPED
    assert "output" not in resumed.snapshots
    stopped = events_of(resumed, EventType.RUN_SAFE_STOPPED)[0]
    assert stopped.payload["explanation"] == (
        "Nothing was sent. Reviewer note: Wrong customer."
    )
    assert stopped.payload["note"] == "Wrong customer."
    assert resumed.review_decisions[0].action == "reject"


async def test_review_reject_without_a_safe_stop_block_still_stops_safely():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    state = await paused_run(executor, with_safe_stop=False)

    resumed = await executor.resume_run(
        state.run_id, {"action": "reject", "note": "Not appropriate."}
    )

    assert resumed.status is RunStatus.SAFELY_STOPPED
    explanation = events_of(resumed, EventType.RUN_SAFE_STOPPED)[0].payload["explanation"]
    assert "rejected" in explanation
    assert "Not appropriate." in explanation


async def test_validator_review_pause_can_be_resumed_with_edited_data():
    executor = WorkflowExecutor(model=FakeModelPort({"category": "billing"}))
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node(
                "validate",
                BlockType.VALIDATOR,
                schema={"owner": {"type": "string"}},
                on_fail="human_review",
            ),
            node("output", BlockType.OUTPUT),
        ]
    )
    state = await executor.start_run(graph, {})

    resumed = await executor.resume_run(
        state.run_id,
        {"action": "edit", "edited_data": {"category": "billing", "owner": "Ada"}},
    )

    assert resumed.status is RunStatus.COMPLETED
    assert resumed.result == {"category": "billing", "owner": "Ada"}
    assert resumed.snapshots["validate"].status is StepStatus.COMPLETED


async def test_resuming_a_run_that_is_not_paused_is_rejected():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    state = await paused_run(executor)
    await executor.resume_run(state.run_id, {"action": "approve"})

    with pytest.raises(InvalidRunState):
        await executor.resume_run(state.run_id, {"action": "approve"})


async def test_a_disallowed_review_action_is_rejected():
    executor = WorkflowExecutor(model=FakeModelPort("Dear Ada, ..."))
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("review", BlockType.HUMAN_REVIEW, allowed_actions=["approve"]),
            node("output", BlockType.OUTPUT),
        ]
    )
    state = await executor.start_run(graph, {"customer": "Ada"})

    with pytest.raises(InvalidRunState):
        await executor.resume_run(state.run_id, {"action": "reject"})
