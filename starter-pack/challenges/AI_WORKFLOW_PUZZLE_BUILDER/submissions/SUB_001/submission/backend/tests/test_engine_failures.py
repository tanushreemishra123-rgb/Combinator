"""The failure-injection seam: staged failures either raise or degrade a step."""

from __future__ import annotations

from conftest import (
    FakeModelPort,
    FakeRetrievalPort,
    ScriptedInjector,
    edge,
    events_of,
    node,
    workflow,
)

from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan
from app.engine.run import RunStatus
from app.engine.trace import EventType, StepStatus


async def test_invalid_json_is_raised_as_an_invalid_output_error():
    injector = ScriptedInjector({("ai", 1): FailurePlan(kind=FailureKind.INVALID_JSON)})
    executor = WorkflowExecutor(model=FakeModelPort({"ok": True}), injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "invalid_output"


async def test_an_injected_timeout_is_raised_as_a_step_timeout():
    injector = ScriptedInjector({("ai", 1): FailurePlan(kind=FailureKind.TIMEOUT)})
    executor = WorkflowExecutor(model=FakeModelPort("x"), injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    assert state.error["kind"] == "timeout"


async def test_a_missing_field_failure_degrades_the_output_for_the_validator():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.MISSING_FIELD, detail={"field": "owner"})}
    )
    executor = WorkflowExecutor(
        model=FakeModelPort({"owner": "Ada", "category": "billing"}), injector=injector
    )
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("validate", BlockType.VALIDATOR, schema={"owner": {"type": "string"}}, on_fail="fail"),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    assert state.snapshots["ai"].output == {"category": "billing"}
    assert state.status is RunStatus.FAILED
    issues = events_of(state, EventType.VALIDATION_RESULT, "validate")[0].payload["issues"]
    assert issues[0]["code"] == "missing_field"


async def test_an_empty_retrieval_failure_leaves_no_documents():
    injector = ScriptedInjector({("search", 1): FailurePlan(kind=FailureKind.EMPTY_RETRIEVAL)})
    retrieval = FakeRetrievalPort([{"id": "doc-1"}, {"id": "doc-2"}])
    executor = WorkflowExecutor(retrieval=retrieval, injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("search", BlockType.RETRIEVAL, query="policy"),
            node("check", BlockType.CONDITION, field="documents", operator="not_empty"),
            node("output", BlockType.OUTPUT),
            node("stop", BlockType.SAFE_STOP, message="I could not find any sources."),
        ],
        edges=[
            edge("input", "search"),
            edge("search", "check"),
            edge("check", "output", "true"),
            edge("check", "stop", "false"),
        ],
    )

    state = await executor.start_run(graph, {"question": "policy?"})

    assert state.snapshots["search"].output == {"question": "policy?", "documents": [], "document_count": 0}
    assert state.status is RunStatus.SAFELY_STOPPED


async def test_a_low_confidence_failure_is_caught_by_the_validator():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.LOW_CONFIDENCE, detail={"confidence": 0.15})}
    )
    executor = WorkflowExecutor(
        model=FakeModelPort({"owner": "Ada"}, confidence=0.95), injector=injector
    )
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node(
                "validate",
                BlockType.VALIDATOR,
                schema={"owner": {"type": "string"}},
                confidence_threshold=0.7,
                on_fail="human_review",
            ),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    assert state.status is RunStatus.PAUSED
    assert state.pending_review.validation.issue_codes == ["low_confidence"]
    assert state.pending_review.validation.confidence == 0.15


async def test_the_injector_is_consulted_once_per_attempt_with_the_run_id():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.MODEL_ERROR), ("ai", 2): FailurePlan(kind=FailureKind.MODEL_ERROR)}
    )
    executor = WorkflowExecutor(model=FakeModelPort("x"), injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("retry", BlockType.RETRY, max_attempts=3, delay_ms=0),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    ai_attempts = [attempt for _, node_id, attempt in injector.consulted if node_id == "ai"]
    assert ai_attempts == [1, 2, 3]
    assert {run_id for run_id, _, _ in injector.consulted} == {state.run_id}
    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
