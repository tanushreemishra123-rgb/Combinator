"""Retry, Timeout and Fallback guards folded onto the step they protect."""

from __future__ import annotations

import asyncio

from conftest import FakeModelPort, FakeToolPort, ScriptedInjector, events_of, node, workflow

from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan, ModelResult
from app.engine.run import RunStatus
from app.engine.trace import EventType, StepStatus

MODEL_ERROR = FailurePlan(kind=FailureKind.MODEL_ERROR, detail={"message": "provider down"})


def guarded_workflow(*guards):
    return workflow(
        [
            node("input", BlockType.INPUT),
            *guards,
            node("ai", BlockType.AI_MODEL, output_field="summary"),
            node("output", BlockType.OUTPUT),
        ]
    )


async def test_retry_guard_exhausts_its_attempts_and_fails_the_run():
    injector = ScriptedInjector(
        {("ai", 1): MODEL_ERROR, ("ai", 2): MODEL_ERROR, ("ai", 3): MODEL_ERROR}
    )
    executor = WorkflowExecutor(model=FakeModelPort("never"), injector=injector)

    state = await executor.start_run(
        guarded_workflow(node("retry", BlockType.RETRY, max_attempts=3, delay_ms=0)),
        {"text": "hi"},
    )

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "model_error"
    assert state.snapshots["ai"].status is StepStatus.FAILED
    assert state.snapshots["ai"].attempts == 3
    assert len(events_of(state, EventType.STEP_STARTED, "ai")) == 3
    assert len(events_of(state, EventType.STEP_RETRYING, "ai")) == 2
    retry_step = state.snapshots["retry"]
    assert retry_step.status is StepStatus.FAILED
    assert retry_step.output["attempts_used"] == 3
    assert events_of(state, EventType.RUN_FAILED)[0].payload["failed_node_id"] == "ai"
    assert "output" not in state.snapshots


async def test_retry_guard_recovers_on_the_second_attempt():
    injector = ScriptedInjector({("ai", 1): MODEL_ERROR})
    model = FakeModelPort("recovered summary")
    executor = WorkflowExecutor(model=model, injector=injector)

    state = await executor.start_run(
        guarded_workflow(node("retry", BlockType.RETRY, max_attempts=2, delay_ms=0)),
        {"text": "hi"},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    assert state.snapshots["ai"].attempts == 2
    assert state.snapshots["retry"].status is StepStatus.RECOVERED
    assert state.snapshots["retry"].output["retried"] is True
    recovered = events_of(state, EventType.STEP_RECOVERED, "ai")[0]
    assert recovered.payload["recovery_action"] == "retry"
    assert recovered.payload["output"]["summary"] == "recovered summary"
    # The first attempt never reached the provider, so it was called exactly once.
    assert model.call_count == 1


async def test_timeout_guard_turns_a_slow_call_into_a_step_timeout():
    model = FakeModelPort("too late", delay=0.2)
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        guarded_workflow(node("timeout", BlockType.TIMEOUT, timeout_ms=20)),
        {"text": "hi"},
    )

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "timeout"
    assert state.error["detail"]["timeout_ms"] == 20
    assert state.snapshots["timeout"].output["timed_out"] is True
    assert state.snapshots["ai"].status is StepStatus.FAILED


async def test_timeout_and_retry_guards_combine_into_one_policy():
    class SlowThenFast:
        """Hangs on the first attempt, answers immediately afterwards."""

        def __init__(self) -> None:
            self.call_count = 0

        async def call(self, prompt_config, data, provider=None):
            self.call_count += 1
            if self.call_count == 1:
                await asyncio.sleep(0.2)
            return ModelResult(data="fast answer", confidence=0.9, provider_used="mock")

    executor = WorkflowExecutor(model=SlowThenFast())

    state = await executor.start_run(
        guarded_workflow(
            node("retry", BlockType.RETRY, max_attempts=2, delay_ms=0),
            node("timeout", BlockType.TIMEOUT, timeout_ms=30),
        ),
        {"text": "hi"},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    assert state.snapshots["timeout"].output["timed_out"] is True
    assert state.result["summary"] == "fast answer"


async def test_fallback_guard_uses_a_safe_default_after_failure():
    injector = ScriptedInjector({("ai", 1): MODEL_ERROR})
    executor = WorkflowExecutor(model=FakeModelPort("never"), injector=injector)

    state = await executor.start_run(
        guarded_workflow(
            node(
                "fallback",
                BlockType.FALLBACK,
                mode="safe_default",
                safe_default={"summary": "Summary unavailable."},
            )
        ),
        {"text": "hi"},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"summary": "Summary unavailable."}
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    assert state.snapshots["fallback"].status is StepStatus.RECOVERED
    used = events_of(state, EventType.FALLBACK_USED, "ai")[0]
    assert used.payload["mode"] == "safe_default"
    assert used.payload["error"]["kind"] == "model_error"


async def test_fallback_guard_switches_to_an_alternate_provider():
    model = FakeModelPort(provider_responses={"backup": "answer from backup"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        guarded_workflow(
            node("fallback", BlockType.FALLBACK, mode="alternate_provider", provider="backup")
        ),
        {"text": "hi"},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"text": "hi", "summary": "answer from backup"}
    assert state.snapshots["ai"].status is StepStatus.RECOVERED
    used = events_of(state, EventType.FALLBACK_USED, "ai")[0]
    assert used.payload["provider"] == "backup"
    assert [call[2] for call in model.calls] == [None, "backup"]
    assert state.snapshots["fallback"].output["used"] is True


async def test_fallback_alternate_provider_can_still_fail():
    model = FakeModelPort(provider_responses={"nobody": "unreachable"})
    executor = WorkflowExecutor(model=model)

    state = await executor.start_run(
        guarded_workflow(
            node("fallback", BlockType.FALLBACK, mode="alternate_provider", provider="backup")
        ),
        {"text": "hi"},
    )

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "model_error"
    assert state.snapshots["fallback"].status is StepStatus.FAILED


async def test_retry_then_fallback_runs_every_attempt_before_recovering():
    injector = ScriptedInjector(
        {("tool", 1): FailurePlan(kind=FailureKind.TOOL_ERROR), ("tool", 2): FailurePlan(kind=FailureKind.TOOL_ERROR)}
    )
    tool = FakeToolPort(result={"ok": True})
    executor = WorkflowExecutor(tool=tool, injector=injector)
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("retry", BlockType.RETRY, max_attempts=2, delay_ms=0),
            node("fallback", BlockType.FALLBACK, mode="safe_default", safe_default={"ok": False}),
            node("tool", BlockType.TOOL, tool="crm"),
            node("output", BlockType.OUTPUT),
        ]
    )

    state = await executor.start_run(graph, {"id": 1})

    assert state.status is RunStatus.COMPLETED
    assert state.result == {"ok": False}
    assert len(events_of(state, EventType.STEP_STARTED, "tool")) == 2
    assert state.snapshots["retry"].output["attempts_used"] == 2
    assert state.snapshots["fallback"].output["used"] is True
    assert tool.call_count == 0
