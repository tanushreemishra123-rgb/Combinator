"""Validator block: structured results and every ``on_fail`` recovery policy."""

from __future__ import annotations

from conftest import FakeModelPort, ScriptedInjector, events_of, node, workflow

from app.engine.errors import ModelFailure
from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan
from app.engine.run import RunStatus
from app.engine.trace import EventType, StepStatus

TICKET_SCHEMA = {
    "owner": {"type": "string", "required": True},
    "category": {"type": "string", "required": True, "allowed": ["billing", "support"]},
}


def validated_workflow(**validator_config):
    config = {"schema": TICKET_SCHEMA, **validator_config}
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Route the ticket"),
            node("validate", BlockType.VALIDATOR, **config),
            node("output", BlockType.OUTPUT),
        ]
    )


async def test_validator_passes_and_the_run_completes():
    model = FakeModelPort({"owner": "Ada", "category": "billing"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(validated_workflow(on_fail="fail"), {"ticket": 1})

    assert state.status is RunStatus.COMPLETED
    result = events_of(state, EventType.VALIDATION_RESULT, "validate")[0]
    assert result.payload["passed"] is True
    assert result.payload["issues"] == []
    assert state.snapshots["validate"].validation.passed is True


async def test_validator_reports_every_issue_it_finds():
    model = FakeModelPort({"category": "urgent"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(validated_workflow(on_fail="fail"), {"ticket": 1})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "validation_failed"
    issues = events_of(state, EventType.VALIDATION_RESULT, "validate")[0].payload["issues"]
    assert {issue["code"] for issue in issues} == {"missing_field", "not_allowed"}
    assert {issue["field"] for issue in issues} == {"owner", "category"}
    assert state.snapshots["validate"].status is StepStatus.FAILED


async def test_validator_failure_falls_back_to_a_safe_default():
    model = FakeModelPort({"category": "billing"})
    safe_default = {"owner": "unassigned", "category": "support", "needs_review": True}
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        validated_workflow(on_fail="safe_default", safe_default=safe_default),
        {"ticket": 1},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.result == safe_default
    assert state.snapshots["validate"].status is StepStatus.RECOVERED
    recovered = events_of(state, EventType.STEP_RECOVERED, "validate")[0]
    assert recovered.payload["recovery_action"] == "validator_safe_default"
    assert recovered.payload["validation"]["passed"] is False


async def test_validator_failure_pauses_for_human_review():
    model = FakeModelPort({"category": "billing"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        validated_workflow(on_fail="human_review", review_prompt="Please fix the owner."),
        {"ticket": 1},
    )

    assert state.status is RunStatus.PAUSED
    review = state.pending_review
    assert review is not None
    assert review.node_id == "validate"
    assert review.prompt == "Please fix the owner."
    assert review.allowed_actions == ["approve", "edit", "reject"]
    assert review.validation.issue_codes == ["missing_field"]
    assert review.resume_node_id == "output"
    assert state.snapshots["validate"].status is StepStatus.PAUSED
    assert events_of(state, EventType.RUN_PAUSED)[0].payload["review"]["node_id"] == "validate"


async def test_validator_low_confidence_is_an_issue():
    model = FakeModelPort({"owner": "Ada", "category": "billing"}, confidence=0.31)
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        validated_workflow(on_fail="fail", confidence_threshold=0.8), {"ticket": 1}
    )

    assert state.status is RunStatus.FAILED
    issues = events_of(state, EventType.VALIDATION_RESULT, "validate")[0].payload["issues"]
    assert issues[0]["code"] == "low_confidence"
    assert issues[0]["actual"] == 0.31
    assert issues[0]["expected"] == 0.8


async def test_validator_retries_the_upstream_step_and_recovers():
    model = FakeModelPort(
        responses=[{"category": "billing"}, {"owner": "Ada", "category": "billing"}]
    )
    executor = WorkflowExecutor(model=model)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("retry", BlockType.RETRY, max_attempts=2, delay_ms=0),
            node("ai", BlockType.AI_MODEL, prompt="Route the ticket"),
            node("validate", BlockType.VALIDATOR, schema=TICKET_SCHEMA, on_fail="retry_upstream"),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {"ticket": 1})

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"owner": "Ada", "category": "billing"}
    assert model.call_count == 2
    retrying = events_of(state, EventType.STEP_RETRYING, "validate")[0]
    assert retrying.payload["recovery_action"] == "retry_upstream"
    assert retrying.payload["upstream_node_id"] == "ai"
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    assert state.snapshots["validate"].status is StepStatus.RECOVERED


async def test_validator_retry_upstream_gives_up_after_its_budget():
    model = FakeModelPort({"category": "billing"})
    executor = WorkflowExecutor(model=model)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Route the ticket"),
            node("validate", BlockType.VALIDATOR, schema=TICKET_SCHEMA, on_fail="retry_upstream"),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {"ticket": 1})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "validation_failed"
    # No retry guard, so the upstream step is re-run exactly once.
    assert state.error["detail"]["retry_upstream_rounds"] == 1
    assert model.call_count == 2
    assert len(events_of(state, EventType.VALIDATION_RESULT, "validate")) == 2


async def test_validator_type_and_range_rules():
    model = FakeModelPort({"owner": "Ada", "score": "high", "tags": []})
    executor = WorkflowExecutor(model=model)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node(
                "validate",
                BlockType.VALIDATOR,
                schema={
                    "owner": {"type": "string"},
                    "score": {"type": "number"},
                    "tags": {"type": "array", "min": 1},
                },
                on_fail="fail",
            ),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {})

    issues = events_of(state, EventType.VALIDATION_RESULT, "validate")[0].payload["issues"]
    codes = {(issue["field"], issue["code"]) for issue in issues}
    assert codes == {("score", "wrong_type"), ("tags", "below_min")}


# ------------------------------------------------------------ on_fail: repair


def repair_workflow(*, ai_config: dict | None = None, schema: dict | None = None, **validator):
    """Input -> AI -> Validator(on_fail=repair) -> Output."""
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Route the ticket", **(ai_config or {})),
            node("validate", BlockType.VALIDATOR, schema=schema or TICKET_SCHEMA, on_fail="repair", **validator),
            node("output", BlockType.OUTPUT),
        ]
    )


async def test_validator_repair_feeds_the_issues_back_to_the_model_and_recovers():
    model = FakeModelPort(responses=[{"category": "billing"}, {"owner": "Ada", "category": "billing"}])
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(repair_workflow(), {"ticket": 1})

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"owner": "Ada", "category": "billing"}
    assert model.call_count == 2
    # The second call carries the rejected answer and the problems found.
    repair = model.calls[1][0]["repair"]
    assert repair["previous_output"] == {"category": "billing"}
    assert repair["issues"][0]["field"] == "owner"
    assert repair["issues"][0]["code"] == "missing_field"
    assert (repair["round"], repair["max_rounds"]) == (1, 1)
    # The trace records the repair as its own event on the validator.
    repairing = events_of(state, EventType.STEP_REPAIRING, "validate")
    assert len(repairing) == 1
    assert repairing[0].payload["recovery_action"] == "repair"
    assert repairing[0].payload["upstream_node_id"] == "ai"
    assert repairing[0].payload["issues"][0]["field"] == "owner"
    assert repairing[0].payload["previous_output"] == {"category": "billing"}
    assert events_of(state, EventType.STEP_RETRYING) == []
    # Both steps recovered by repair.
    ai_recovered = events_of(state, EventType.STEP_RECOVERED, "ai")[0]
    assert ai_recovered.payload["recovery_action"] == "repair"
    assert ai_recovered.payload["repair_round"] == 1
    validator_recovered = events_of(state, EventType.STEP_RECOVERED, "validate")[0]
    assert validator_recovered.payload["recovery_action"] == "repair"
    assert validator_recovered.payload["repairs_used"] == 1
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    assert state.snapshots["validate"].status is StepStatus.RECOVERED
    assert state.attempts["ai"] == 2


async def test_validator_repair_gives_up_after_max_repairs():
    model = FakeModelPort({"category": "billing"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(repair_workflow(max_repairs=2), {"ticket": 1})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "validation_failed"
    assert state.error["detail"]["repairs_used"] == 2
    assert model.call_count == 3
    assert len(events_of(state, EventType.VALIDATION_RESULT, "validate")) == 3
    assert len(events_of(state, EventType.STEP_REPAIRING, "validate")) == 2
    assert state.snapshots["validate"].status is StepStatus.FAILED


async def test_validator_repair_needs_an_ai_step_directly_upstream():
    model = FakeModelPort({"owner": "Ada", "category": "billing"})
    executor = WorkflowExecutor(model=model)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("shape", BlockType.TRANSFORM, operation="merge", values={"category": "billing"}),
            node("validate", BlockType.VALIDATOR, schema=TICKET_SCHEMA, on_fail="repair"),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {"ticket": 1})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "validation_failed"
    assert state.error["detail"]["repair"] == {"reason": "no_ai_model_upstream"}
    assert model.call_count == 0
    assert events_of(state, EventType.STEP_REPAIRING) == []


async def test_validator_repair_picks_the_previous_answer_by_output_field():
    model = FakeModelPort(responses=[{"category": "billing"}, {"owner": "Ada", "category": "billing"}])
    executor = WorkflowExecutor(model=model)
    graph = repair_workflow(
        ai_config={"output_field": "minutes"},
        schema={"minutes.owner": {"type": "string"}},
    )

    state = await executor.start_run(graph, {"ticket": 1})

    assert state.status is RunStatus.COMPLETED
    repair = model.calls[1][0]["repair"]
    assert repair["previous_output"] == {"category": "billing"}  # the nested answer only
    assert repair["output_field"] == "minutes"
    assert state.result["minutes"] == {"owner": "Ada", "category": "billing"}


async def test_repair_rounds_are_new_invocations_for_the_injector():
    """A staged ``first_n: 1`` failure must not fire again on the repair round."""
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.MISSING_FIELD, detail={"field": "owner"})}
    )
    model = FakeModelPort({"owner": "Ada", "category": "billing"})
    executor = WorkflowExecutor(model=model, injector=injector)

    state = await executor.start_run(repair_workflow(), {"ticket": 1})

    assert state.status is RunStatus.COMPLETED
    assert [attempt for (_, node_id, attempt) in injector.consulted if node_id == "ai"] == [1, 2]
    assert model.call_count == 2
    assert state.result == {"owner": "Ada", "category": "billing"}


async def test_a_repair_round_that_raises_fails_the_run_at_the_ai_step():
    model = FakeModelPort(responses=[{"category": "billing"}, ModelFailure("provider down")])
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(repair_workflow(), {"ticket": 1})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "model_error"
    assert events_of(state, EventType.RUN_FAILED)[0].payload["failed_node_id"] == "ai"
    assert len(events_of(state, EventType.STEP_REPAIRING, "validate")) == 1


async def test_a_custom_repair_prompt_reaches_the_model():
    model = FakeModelPort(responses=[{"category": "billing"}, {"owner": "Ada", "category": "billing"}])
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        repair_workflow(repair_prompt="Add the owner you heard in the notes."), {"ticket": 1}
    )

    assert state.status is RunStatus.COMPLETED
    assert model.calls[1][0]["repair"]["instruction"] == "Add the owner you heard in the notes."


def test_validator_config_defaults_and_bounds_for_repair():
    from pydantic import ValidationError

    from app.blocks.validator import ValidatorBlock, ValidatorConfig

    assert ValidatorConfig(on_fail="repair").max_repairs == 1
    assert ValidatorBlock().parse_config(node("v", BlockType.VALIDATOR, on_fail="repair")).on_fail == "repair"
    for bad in (0, 6):
        try:
            ValidatorConfig(on_fail="repair", max_repairs=bad)
        except ValidationError:
            continue
        raise AssertionError(f"max_repairs={bad} should be rejected")
