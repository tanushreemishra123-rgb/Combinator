"""Linear execution, branching, data blocks and the safe stop terminal."""

from __future__ import annotations

from conftest import (
    FakeModelPort,
    FakeRetrievalPort,
    FakeToolPort,
    edge,
    events_of,
    node,
    workflow,
)

from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.run import RunStatus
from app.engine.trace import EventType, StepStatus


def summarizer_workflow():
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Summarise", output_field="summary"),
            node("output", BlockType.OUTPUT),
        ]
    )


async def test_linear_input_ai_output_happy_path():
    model = FakeModelPort("A short summary.")
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(summarizer_workflow(), {"text": "long notes"})

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"text": "long notes", "summary": "A short summary."}
    assert [snapshot.status for snapshot in state.snapshots.values()] == [
        StepStatus.COMPLETED
    ] * 3
    assert state.step_order == ["input", "ai", "output"]
    assert model.call_count == 1
    assert events_of(state, EventType.RUN_COMPLETED)[0].payload["result"] == state.result


async def test_step_snapshots_capture_input_and_output():
    executor = WorkflowExecutor(model=FakeModelPort("done"))

    state = await executor.start_run(summarizer_workflow(), {"text": "hello"})

    ai = state.snapshots["ai"]
    assert ai.input == {"text": "hello"}
    assert ai.output == {"text": "hello", "summary": "done"}
    assert ai.attempts == 1


async def test_model_metadata_reaches_the_trace():
    executor = WorkflowExecutor(model=FakeModelPort("done", confidence=0.42, provider="mock"))

    state = await executor.start_run(summarizer_workflow(), {"text": "hello"})

    completed = events_of(state, EventType.STEP_COMPLETED, "ai")[0]
    assert completed.payload["confidence"] == 0.42
    assert completed.payload["provider_used"] == "mock"
    assert completed.payload["mocked"] is True


def branching_workflow():
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("check", BlockType.CONDITION, field="priority", operator="eq", value="high"),
            node("ai", BlockType.AI_MODEL, output_field="summary"),
            node("output", BlockType.OUTPUT),
            node(
                "stop",
                BlockType.SAFE_STOP,
                message="Only high priority tickets are summarised.",
            ),
        ],
        edges=[
            edge("input", "check"),
            edge("check", "ai", "true"),
            edge("check", "stop", "false"),
            edge("ai", "output"),
        ],
    )


async def test_condition_follows_the_true_branch():
    executor = WorkflowExecutor(model=FakeModelPort("summary"))

    state = await executor.start_run(branching_workflow(), {"priority": "high"})

    assert state.status is RunStatus.COMPLETED
    assert state.result["summary"] == "summary"
    assert "stop" not in state.snapshots
    condition_event = events_of(state, EventType.STEP_COMPLETED, "check")[0]
    assert condition_event.payload["matched"] is True
    assert condition_event.payload["branch"] == "true"


async def test_condition_follows_the_false_branch_into_a_safe_stop():
    executor = WorkflowExecutor(model=FakeModelPort("summary"))

    state = await executor.start_run(branching_workflow(), {"priority": "low"})

    assert state.status is RunStatus.SAFELY_STOPPED
    assert "ai" not in state.snapshots
    assert state.snapshots["stop"].status is StepStatus.SAFELY_STOPPED
    stopped = events_of(state, EventType.RUN_SAFE_STOPPED)[0]
    assert stopped.payload["explanation"] == "Only high priority tickets are summarised."


async def test_condition_not_empty_operator_handles_missing_fields():
    executor = WorkflowExecutor(model=FakeModelPort("summary"))
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("check", BlockType.CONDITION, field="documents", operator="not_empty"),
            node("ai", BlockType.AI_MODEL, output_field="answer"),
            node("output", BlockType.OUTPUT),
            node("stop", BlockType.SAFE_STOP, message="I could not find any sources."),
        ],
        edges=[
            edge("input", "check"),
            edge("check", "ai", "true"),
            edge("check", "stop", "false"),
            edge("ai", "output"),
        ],
    )

    state = await executor.start_run(graph, {"documents": []})

    assert state.status is RunStatus.SAFELY_STOPPED


async def test_transform_and_tool_and_retrieval_blocks_chain_together():
    tool = FakeToolPort(result={"ticket_id": "T-1"})
    retrieval = FakeRetrievalPort([{"id": "doc-1", "text": "policy"}])
    executor = WorkflowExecutor(
        model=FakeModelPort("answer"), tool=tool, retrieval=retrieval
    )
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("search", BlockType.RETRIEVAL, query="policy", output_field="documents"),
            node("create", BlockType.TOOL, tool="ticket_api", output_field="ticket"),
            node(
                "shape",
                BlockType.TRANSFORM,
                operation="pick",
                fields=["ticket", "document_count"],
            ),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {"question": "what is the policy?"})

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"ticket": {"ticket_id": "T-1"}, "document_count": 1}
    assert tool.calls[0][0] == "ticket_api"
    assert retrieval.calls[0][1] == {"question": "what is the policy?"}


async def test_transform_template_renders_from_data():
    executor = WorkflowExecutor()
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node(
                "greet",
                BlockType.TRANSFORM,
                operation="template",
                template="Hello {name}, you have {count} tickets.",
                target="message",
            ),
            node("output", BlockType.OUTPUT, field="message"),
        ]
    )

    state = await executor.start_run(graph, {"name": "Ada", "count": 3})

    assert state.result == "Hello Ada, you have 3 tickets."
