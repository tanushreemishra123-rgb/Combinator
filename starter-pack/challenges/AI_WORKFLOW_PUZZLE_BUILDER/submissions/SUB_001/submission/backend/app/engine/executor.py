"""The workflow execution engine.

Responsibility: walk a validated workflow graph one step at a time and turn every
observable moment - an attempt, a retry, a fallback, a validation result, a pause
for a human, a safe stop - into trace events and run state. All capability
(models, tools, retrieval, failure injection) arrives through ports; all block
behaviour lives in ``app.blocks``. This module owns *orchestration only*: routing,
guard policies, recovery decisions (a retry, a fallback, a repair round that sends
a rejected answer back to the model) and run lifecycle.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from app.blocks import get_block
from app.blocks.base import (
    MISSING,
    Block,
    BlockConfig,
    BlockContext,
    BlockResult,
    Control,
    drop_path,
    get_path,
    set_path,
)
from app.blocks.guards import FallbackConfig, RetryConfig, TimeoutConfig
from app.blocks.validator import ValidatorConfig
from app.engine.errors import (
    ConfigurationError,
    InvalidOutputError,
    InvalidRunState,
    ModelFailure,
    StepExecutionError,
    StepTimeout,
    ToolFailure,
    ValidationFailed,
)
from app.engine.graph import GraphValidationReport, raise_for_invalid, validate_workflow
from app.engine.model import (
    GUARD_TYPES,
    BlockType,
    NodeDef,
    WorkflowDef,
)
from app.engine.ports import (
    EnginePorts,
    FailureInjector,
    FailureKind,
    FailurePlan,
    ModelPort,
    RetrievalPort,
    ToolPort,
)
from app.engine.run import (
    RepairRequest,
    ReviewDecision,
    ReviewRequest,
    RunState,
    RunStatus,
    StepSnapshot,
    ValidationResult,
)
from app.engine.store import InMemoryRunStore
from app.engine.trace import EventType, StepStatus, TraceRecorder, utcnow

DEFAULT_STOP_MESSAGE = (
    "The workflow stopped safely instead of continuing with an unreliable result."
)


@dataclass(slots=True)
class GuardPolicy:
    """The reliability policy folded out of the guards preceding a step."""

    nodes: list[NodeDef] = field(default_factory=list)
    retry: RetryConfig | None = None
    timeout: TimeoutConfig | None = None
    fallback: FallbackConfig | None = None

    @property
    def max_attempts(self) -> int:
        return self.retry.max_attempts if self.retry else 1

    @property
    def delay_ms(self) -> int:
        return self.retry.delay_ms if self.retry else 0

    @property
    def timeout_ms(self) -> int | None:
        return self.timeout.timeout_ms if self.timeout else None


@dataclass(slots=True)
class StepOutcome:
    """What happened across every attempt of one step."""

    node: NodeDef
    status: StepStatus
    result: BlockResult | None = None
    attempts_used: int = 0
    first_invocation: int = 1
    error: StepExecutionError | None = None
    recovery: str | None = None
    timed_out: bool = False

    @property
    def failed(self) -> bool:
        return self.status is StepStatus.FAILED


@dataclass(slots=True)
class _Validated:
    """The result of applying a validator's on-fail policy."""

    data: Any
    terminal: bool


@dataclass(slots=True)
class _Anchor:
    """The most recent re-runnable step, used by ``on_fail: retry_upstream``."""

    node: NodeDef
    input: Any
    policy: GuardPolicy


class WorkflowExecutor:
    """Executes workflows against injected ports and records everything it does."""

    def __init__(
        self,
        store: InMemoryRunStore | None = None,
        *,
        model: ModelPort | None = None,
        tool: ToolPort | None = None,
        retrieval: RetrievalPort | None = None,
        injector: FailureInjector | None = None,
    ) -> None:
        self.store = store or InMemoryRunStore()
        self.ports = EnginePorts(
            model=model, tool=tool, retrieval=retrieval, injector=injector
        )

    # ------------------------------------------------------------- public API

    def validate(self, workflow: WorkflowDef) -> GraphValidationReport:
        """Structured pre-flight check of a workflow graph."""
        return validate_workflow(workflow)

    async def start_run(
        self,
        workflow: WorkflowDef,
        sample_input: Any = None,
        *,
        scenario_id: str | None = None,
        run_id: str | None = None,
    ) -> RunState:
        """Validate then execute ``workflow``, returning the finished/paused run."""
        raise_for_invalid(workflow)
        state = self.store.create(
            workflow, sample_input, scenario_id=scenario_id, run_id=run_id
        )
        recorder = self._recorder(state)
        recorder.emit(
            EventType.RUN_STARTED,
            status=StepStatus.RUNNING,
            payload={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "input": sample_input,
                "scenario_id": scenario_id,
            },
        )
        start = workflow.input_nodes[0]
        return await self._drive(state, recorder, start.id, sample_input)

    async def resume_run(
        self, run_id: str, decision: ReviewDecision | dict[str, Any]
    ) -> RunState:
        """Apply a human's decision to a paused run and continue executing it."""
        state = self.store.get(run_id)
        if state.status is not RunStatus.PAUSED or state.pending_review is None:
            raise InvalidRunState(
                f"Run {run_id!r} is {state.status.value}, not waiting for a review."
            )
        if not isinstance(decision, ReviewDecision):
            decision = ReviewDecision.model_validate(decision)
        review = state.pending_review
        if decision.action not in review.allowed_actions:
            raise InvalidRunState(
                f"Action {decision.action!r} is not allowed for this review."
            )

        recorder = self._recorder(state)
        state.review_decisions.append(decision)
        recorder.emit(
            EventType.REVIEW_DECISION,
            node_id=review.node_id,
            node_label=review.node_label,
            node_type=state.workflow.node(review.node_id).type,
            status=StepStatus.COMPLETED,
            payload={
                "action": decision.action,
                "note": decision.note,
                "edited_data": decision.edited_data,
                "data_before": review.data,
            },
        )
        state.pending_review = None
        state.status = RunStatus.RUNNING

        if decision.action == "reject":
            return await self._handle_rejection(state, recorder, review, decision)

        data = review.data
        if decision.action == "edit" and decision.edited_data is not None:
            data = decision.edited_data
        self._update_review_snapshot(
            state, review, StepStatus.COMPLETED, data, decision
        )
        state.data = data
        recorder.emit(
            EventType.RUN_RESUMED,
            node_id=review.node_id,
            node_label=review.node_label,
            status=StepStatus.RUNNING,
            payload={"action": decision.action, "data": data},
        )
        if review.resume_node_id is None:
            return self._complete_run(state, recorder, None, data)
        return await self._drive(state, recorder, review.resume_node_id, data)

    async def resume_from_last_successful(self, run_id: str) -> RunState:
        """Clone a finished run and re-run it from just after its last good step.

        Every reused step is replayed into the new run's trace as a ``skipped``
        step so the UI can show what was carried over.
        """
        source = self.store.get(run_id)
        if source.status is RunStatus.RUNNING:
            raise InvalidRunState(f"Run {run_id!r} is still running.")

        anchor_id = self.store.resume_anchor(source)
        clone = self.store.clone_for_resume(run_id)
        recorder = self._recorder(clone)
        recorder.emit(
            EventType.RUN_STARTED,
            status=StepStatus.RUNNING,
            payload={
                "workflow_id": clone.workflow.id,
                "input": clone.input,
                "scenario_id": clone.scenario_id,
                "resumed_from": source.run_id,
                "resume_after_node_id": anchor_id,
            },
        )
        for node_id in clone.step_order:
            snapshot = clone.snapshots[node_id]
            recorder.emit(
                EventType.STEP_SKIPPED,
                node_id=snapshot.node_id,
                node_label=snapshot.node_label,
                node_type=snapshot.node_type,
                status=StepStatus.SKIPPED,
                payload={
                    "input": snapshot.input,
                    "output": snapshot.output,
                    "reused_from": source.run_id,
                    "original_status": source.snapshots[node_id].status.value,
                },
            )

        if anchor_id is None:
            return await self._drive(
                clone,
                recorder,
                clone.workflow.input_nodes[0].id,
                clone.input,
            )

        anchor_snapshot = clone.snapshots[anchor_id]
        data = anchor_snapshot.output
        clone.data = data
        next_id = self._next_node_id(clone.workflow, clone.workflow.node(anchor_id))
        if next_id is None:
            return self._complete_run(state=clone, recorder=recorder, node=None, data=data)
        return await self._drive(clone, recorder, next_id, data)

    # ---------------------------------------------------------------- driving

    def _recorder(self, state: RunState) -> TraceRecorder:
        return TraceRecorder(state.run_id, state.trace, self.store.queue(state.run_id))

    async def _drive(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node_id: str | None,
        data: Any,
    ) -> RunState:
        """The main loop: execute steps until the run ends or pauses."""
        workflow = state.workflow
        anchor: _Anchor | None = None

        while node_id is not None:
            entry = workflow.node(node_id)
            policy, node = self._fold_guards(workflow, entry)
            if node is None:
                return self._fail_run(
                    state,
                    recorder,
                    entry,
                    ConfigurationError(
                        f"{entry.display_label} does not protect any block.",
                        node_id=entry.id,
                    ),
                )
            state.current_node = node.id
            step_input = data
            self._emit_guard_starts(state, recorder, policy, node)
            outcome = await self._execute_step(state, recorder, node, step_input, policy)
            self._record_guards(state, recorder, policy, node, outcome)

            if outcome.failed:
                self._finish_step(state, recorder, node, step_input, outcome)
                return self._fail_run(state, recorder, node, outcome.error)

            result = outcome.result
            if result is None:  # a non-failed outcome always carries a result
                raise RuntimeError(
                    f"Step {node.id!r} reported success without a result."
                )

            # A block that asks to pause or stop reports that status for its step.
            if result.control is Control.PAUSE:
                outcome.status = StepStatus.PAUSED
            elif result.control is Control.SAFE_STOP:
                outcome.status = StepStatus.SAFELY_STOPPED

            if node.type is BlockType.VALIDATOR:
                handled = await self._handle_validation(
                    state, recorder, node, step_input, outcome, anchor
                )
                if handled.terminal:
                    return state
                data = handled.data
            else:
                self._finish_step(state, recorder, node, step_input, outcome)
                data = result.data

            state.data = data

            if result.control is Control.PAUSE:
                return self._pause_run(state, recorder, node, result, data)
            if result.control is Control.SAFE_STOP or node.type is BlockType.SAFE_STOP:
                return self._safe_stop_run(state, recorder, node, result, data)
            if node.type is BlockType.OUTPUT:
                return self._complete_run(state, recorder, node, data)

            if node.type not in GUARD_TYPES and node.type not in {
                BlockType.CONDITION,
                BlockType.VALIDATOR,
            }:
                anchor = _Anchor(node=node, input=step_input, policy=policy)

            handle = result.handle if node.type is BlockType.CONDITION else None
            node_id = self._next_node_id(workflow, node, handle)
            if node_id is None:
                return self._fail_run(
                    state,
                    recorder,
                    node,
                    ConfigurationError(
                        f"{node.display_label} has nowhere to send the run next.",
                        node_id=node.id,
                    ),
                )

        return state

    def _next_node_id(
        self, workflow: WorkflowDef, node: NodeDef, handle: str | None = None
    ) -> str | None:
        edges = workflow.outgoing(node.id, handle)
        return edges[0].target if edges else None

    # ------------------------------------------------------------------ steps

    def _fold_guards(
        self, workflow: WorkflowDef, entry: NodeDef
    ) -> tuple[GuardPolicy, NodeDef | None]:
        """Collect consecutive guards into one policy for the block they protect."""
        policy = GuardPolicy()
        current: NodeDef | None = entry
        seen: set[str] = set()
        while current is not None and current.type in GUARD_TYPES:
            if current.id in seen:
                return policy, None
            seen.add(current.id)
            policy.nodes.append(current)
            block = get_block(current.type)
            try:
                config = block.parse_config(current)
            except ValidationError:
                config = block.config_model()
            if current.type is BlockType.RETRY:
                policy.retry = config  # type: ignore[assignment]
            elif current.type is BlockType.TIMEOUT:
                policy.timeout = config  # type: ignore[assignment]
            else:
                policy.fallback = config  # type: ignore[assignment]
            next_id = self._next_node_id(workflow, current)
            current = workflow.find(next_id) if next_id else None
        return policy, current

    def _emit_guard_starts(
        self,
        state: RunState,
        recorder: TraceRecorder,
        policy: GuardPolicy,
        node: NodeDef,
    ) -> None:
        for guard in policy.nodes:
            recorder.emit(
                EventType.STEP_STARTED,
                node_id=guard.id,
                node_label=guard.display_label,
                node_type=guard.type,
                status=StepStatus.RUNNING,
                payload={
                    "protects": node.id,
                    "protects_label": node.display_label,
                    "config": dict(guard.config or {}),
                },
            )

    def _record_guards(
        self,
        state: RunState,
        recorder: TraceRecorder,
        policy: GuardPolicy,
        node: NodeDef,
        outcome: StepOutcome,
    ) -> None:
        """Close out each guard step, describing what the guard actually did."""
        for guard in policy.nodes:
            payload: dict[str, Any] = {
                "protects": node.id,
                "protects_label": node.display_label,
            }
            status = StepStatus.COMPLETED
            if guard.type is BlockType.RETRY:
                payload.update(
                    attempts_used=outcome.attempts_used,
                    max_attempts=policy.max_attempts,
                    retried=outcome.attempts_used > 1,
                )
                if outcome.recovery == "retry":
                    status = StepStatus.RECOVERED
            elif guard.type is BlockType.TIMEOUT:
                payload.update(
                    timeout_ms=policy.timeout_ms, timed_out=outcome.timed_out
                )
            else:
                used = bool(outcome.recovery and outcome.recovery.startswith("fallback"))
                payload.update(
                    mode=policy.fallback.mode if policy.fallback else None,
                    provider=policy.fallback.provider if policy.fallback else None,
                    used=used,
                )
                if used:
                    status = StepStatus.RECOVERED
            if outcome.failed:
                status = StepStatus.FAILED
                payload["error"] = (
                    outcome.error.to_payload() if outcome.error else None
                )
            recorder.emit(
                EventType.STEP_COMPLETED if not outcome.failed else EventType.STEP_FAILED,
                node_id=guard.id,
                node_label=guard.display_label,
                node_type=guard.type,
                status=status,
                payload=payload,
            )
            state.record(
                StepSnapshot(
                    node_id=guard.id,
                    node_label=guard.display_label,
                    node_type=guard.type,
                    status=status,
                    input=None,
                    output=payload,
                    attempts=1,
                    finished_at=utcnow(),
                )
            )

    async def _execute_step(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        data: Any,
        policy: GuardPolicy,
        repair: RepairRequest | None = None,
    ) -> StepOutcome:
        """Run one block under its guard policy, emitting attempt-level events.

        ``repair`` is set only when a validator is re-invoking this step with its
        rejected answer and the problems found (``on_fail: repair``).
        """
        block = get_block(node.type)
        try:
            config = block.parse_config(node)
        except ValidationError as exc:
            return StepOutcome(
                node=node,
                status=StepStatus.FAILED,
                error=ConfigurationError(
                    f"{node.display_label} is not configured correctly.",
                    node_id=node.id,
                    detail={"errors": exc.errors(include_url=False)},
                ),
            )

        max_attempts = policy.max_attempts
        first_invocation: int | None = None
        last_error: StepExecutionError | None = None
        attempts_used = 0
        timed_out = False

        for attempt in range(1, max_attempts + 1):
            invocation = state.next_attempt(node.id)
            if first_invocation is None:
                first_invocation = invocation
            attempts_used = attempt
            recorder.emit(
                EventType.STEP_STARTED,
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=StepStatus.RUNNING,
                payload={
                    "input": data,
                    "attempt": attempt,
                    "invocation": invocation,
                    "max_attempts": max_attempts,
                    **(
                        {"recovery_action": "repair", "repair_round": repair.round}
                        if repair is not None
                        else {}
                    ),
                },
            )
            try:
                result = await self._invoke(
                    state,
                    node,
                    block,
                    config,
                    data,
                    invocation,
                    None,
                    policy.timeout_ms,
                    repair=repair,
                )
            except StepExecutionError as exc:
                last_error = exc
                timed_out = timed_out or isinstance(exc, StepTimeout)
                if attempt < max_attempts:
                    recorder.emit(
                        EventType.STEP_RETRYING,
                        node_id=node.id,
                        node_label=node.display_label,
                        node_type=node.type,
                        status=StepStatus.RETRYING,
                        payload={
                            "attempt": attempt,
                            "next_attempt": attempt + 1,
                            "max_attempts": max_attempts,
                            "error": exc.to_payload(),
                            "recovery_action": "retry",
                        },
                    )
                    if policy.delay_ms:
                        await asyncio.sleep(policy.delay_ms / 1000)
                continue

            recovered = attempt > 1 or (first_invocation or 1) > 1
            return StepOutcome(
                node=node,
                status=StepStatus.RECOVERED if recovered else StepStatus.COMPLETED,
                result=result,
                attempts_used=attempt,
                first_invocation=first_invocation or 1,
                recovery="retry" if attempt > 1 else None,
                timed_out=timed_out,
            )

        if policy.fallback is not None:
            recovered = await self._apply_fallback(
                state,
                recorder,
                node,
                block,
                config,
                data,
                policy,
                last_error,
                attempts_used,
                first_invocation or 1,
                timed_out,
            )
            if recovered is not None:
                return recovered

        return StepOutcome(
            node=node,
            status=StepStatus.FAILED,
            attempts_used=attempts_used,
            first_invocation=first_invocation or 1,
            error=last_error,
            timed_out=timed_out,
        )

    async def _apply_fallback(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        block: Block,
        config: BlockConfig,
        data: Any,
        policy: GuardPolicy,
        error: StepExecutionError | None,
        attempts_used: int,
        first_invocation: int,
        timed_out: bool,
    ) -> StepOutcome | None:
        """Try to rescue an exhausted step; returns ``None`` if the rescue failed."""
        fallback = policy.fallback
        if fallback is None:  # only reached via the caller's own fallback check
            raise RuntimeError(
                f"Step {node.id!r} tried to use a fallback that is not configured."
            )
        error_payload = error.to_payload() if error else None

        if fallback.mode == "safe_default":
            recorder.emit(
                EventType.FALLBACK_USED,
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=StepStatus.RECOVERED,
                payload={
                    "mode": "safe_default",
                    "output": fallback.safe_default,
                    "error": error_payload,
                    "recovery_action": "fallback_safe_default",
                },
            )
            return StepOutcome(
                node=node,
                status=StepStatus.RECOVERED,
                result=BlockResult(
                    data=fallback.safe_default, meta={"fallback": "safe_default"}
                ),
                attempts_used=attempts_used,
                first_invocation=first_invocation,
                recovery="fallback_safe_default",
                timed_out=timed_out,
            )

        invocation = state.next_attempt(node.id)
        recorder.emit(
            EventType.STEP_STARTED,
            node_id=node.id,
            node_label=node.display_label,
            node_type=node.type,
            status=StepStatus.RUNNING,
            payload={
                "input": data,
                "attempt": attempts_used + 1,
                "invocation": invocation,
                "provider": fallback.provider,
                "recovery_action": "fallback_alternate_provider",
            },
        )
        try:
            result = await self._invoke(
                state,
                node,
                block,
                config,
                data,
                invocation,
                fallback.provider,
                policy.timeout_ms,
            )
        except StepExecutionError as exc:
            recorder.emit(
                EventType.STEP_RETRYING,
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=StepStatus.FAILED,
                payload={
                    "attempt": attempts_used + 1,
                    "error": exc.to_payload(),
                    "recovery_action": "fallback_alternate_provider",
                    "recovered": False,
                },
            )
            return None

        recorder.emit(
            EventType.FALLBACK_USED,
            node_id=node.id,
            node_label=node.display_label,
            node_type=node.type,
            status=StepStatus.RECOVERED,
            payload={
                "mode": "alternate_provider",
                "provider": fallback.provider,
                "output": result.data,
                "error": error_payload,
                "recovery_action": "fallback_alternate_provider",
            },
        )
        return StepOutcome(
            node=node,
            status=StepStatus.RECOVERED,
            result=result,
            attempts_used=attempts_used + 1,
            first_invocation=first_invocation,
            recovery="fallback_alternate_provider",
            timed_out=timed_out,
        )

    async def _invoke(
        self,
        state: RunState,
        node: NodeDef,
        block: Block,
        config: BlockConfig,
        data: Any,
        invocation: int,
        provider_override: str | None,
        timeout_ms: int | None,
        repair: RepairRequest | None = None,
    ) -> BlockResult:
        """One attempt: consult the injector, run the block, apply any degradation."""
        plan: FailurePlan | None = None
        if self.ports.injector is not None:
            plan = self.ports.injector.should_fail(state.run_id, node.id, invocation)
        if plan is not None and plan.raises:
            raise _plan_error(plan, node)

        ctx = BlockContext(
            node=node,
            config=config,
            data=data,
            run_id=state.run_id,
            attempt=invocation,
            ports=self.ports,
            provider_override=provider_override,
            scenario_id=state.scenario_id,
            confidence=state.last_confidence,
            repair=repair,
        )
        coroutine = block.execute(ctx)
        if timeout_ms is not None:
            try:
                result = await asyncio.wait_for(coroutine, timeout_ms / 1000)
            except TimeoutError as exc:
                raise StepTimeout(
                    f"{node.display_label} took longer than {timeout_ms} ms.",
                    node_id=node.id,
                    detail={"timeout_ms": timeout_ms},
                ) from exc
        else:
            result = await coroutine

        if plan is not None:
            result = _degrade(plan, result, node)
        if result.confidence is not None:
            state.last_confidence = result.confidence
        return result

    # ------------------------------------------------------------- validation

    async def _handle_validation(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        step_input: Any,
        outcome: StepOutcome,
        anchor: _Anchor | None,
    ) -> _Validated:
        """Apply a validator's ``on_fail`` policy, emitting the validation trace."""
        result = outcome.result
        if result is None:  # validation only runs for a step that succeeded
            raise RuntimeError(f"Validator {node.id!r} has no result to validate.")
        config: ValidatorConfig = get_block(node.type).parse_config(node)  # type: ignore[assignment]
        validation = result.validation or ValidationResult(passed=True)
        self._emit_validation(recorder, node, validation, config.on_fail)

        if validation.passed:
            self._finish_step(state, recorder, node, step_input, outcome, validation=validation)
            return _Validated(data=result.data, terminal=False)

        if config.on_fail == "safe_default":
            recovered = StepOutcome(
                node=node,
                status=StepStatus.RECOVERED,
                result=BlockResult(data=config.safe_default),
                attempts_used=outcome.attempts_used,
                first_invocation=outcome.first_invocation,
                recovery="validator_safe_default",
            )
            self._finish_step(
                state, recorder, node, step_input, recovered, validation=validation
            )
            state.data = config.safe_default
            return _Validated(data=config.safe_default, terminal=False)

        if config.on_fail == "human_review":
            review = ReviewRequest(
                node_id=node.id,
                node_label=node.display_label,
                prompt=config.review_prompt
                or "Validation failed. Approve, edit or reject this result.",
                data=result.data,
                validation=validation,
            )
            paused = StepOutcome(
                node=node,
                status=StepStatus.PAUSED,
                result=BlockResult(data=result.data, control=Control.PAUSE, review=review),
                attempts_used=outcome.attempts_used,
                first_invocation=outcome.first_invocation,
            )
            self._finish_step(
                state, recorder, node, step_input, paused, validation=validation
            )
            self._pause_run(state, recorder, node, paused.result, result.data)
            return _Validated(data=result.data, terminal=True)

        if config.on_fail == "retry_upstream" and anchor is not None:
            return await self._retry_upstream(
                state, recorder, node, step_input, outcome, anchor, validation, config
            )

        detail: dict[str, Any] = {
            "issues": [issue.model_dump() for issue in validation.issues]
        }
        if config.on_fail == "repair":
            if anchor is not None and anchor.node.type is BlockType.AI_MODEL:
                return await self._repair_upstream(
                    state, recorder, node, step_input, outcome, anchor, validation, config
                )
            # Only an AI Model step can be asked to fix its own answer.
            detail["repair"] = {"reason": "no_ai_model_upstream"}

        failure = ValidationFailed(
            _validation_message(validation, node),
            node_id=node.id,
            detail=detail,
        )
        failed = StepOutcome(
            node=node,
            status=StepStatus.FAILED,
            attempts_used=outcome.attempts_used,
            first_invocation=outcome.first_invocation,
            error=failure,
        )
        self._finish_step(state, recorder, node, step_input, failed, validation=validation)
        self._fail_run(state, recorder, node, failure)
        return _Validated(data=result.data, terminal=True)

    async def _retry_upstream(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        step_input: Any,
        outcome: StepOutcome,
        anchor: _Anchor,
        validation: ValidationResult,
        config: ValidatorConfig,
    ) -> _Validated:
        """Re-run the previous step (within its retry budget) and re-validate."""
        budget = anchor.policy.max_attempts
        single = GuardPolicy(
            nodes=[], retry=None, timeout=anchor.policy.timeout, fallback=None
        )
        current_validation = validation
        data = step_input

        for round_number in range(1, budget + 1):
            recorder.emit(
                EventType.STEP_RETRYING,
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=StepStatus.RETRYING,
                payload={
                    "recovery_action": "retry_upstream",
                    "upstream_node_id": anchor.node.id,
                    "upstream_node_label": anchor.node.display_label,
                    "round": round_number,
                    "max_rounds": budget,
                    "issues": [issue.model_dump() for issue in current_validation.issues],
                },
            )
            upstream = await self._execute_step(
                state, recorder, anchor.node, anchor.input, single
            )
            self._finish_step(state, recorder, anchor.node, anchor.input, upstream)
            if upstream.failed:
                self._fail_run(state, recorder, anchor.node, upstream.error)
                return _Validated(data=data, terminal=True)

            if upstream.result is None:  # a non-failed outcome carries a result
                raise RuntimeError(
                    f"Retry of {anchor.node.id!r} reported success without a result."
                )
            data = upstream.result.data
            state.data = data

            revalidated = await self._execute_step(state, recorder, node, data, GuardPolicy())
            if revalidated.failed:
                self._finish_step(state, recorder, node, data, revalidated)
                self._fail_run(state, recorder, node, revalidated.error)
                return _Validated(data=data, terminal=True)

            if revalidated.result is None:  # a non-failed outcome carries a result
                raise RuntimeError(
                    f"Re-validation of {node.id!r} reported success without a result."
                )
            current_validation = revalidated.result.validation or ValidationResult(
                passed=True
            )
            self._emit_validation(recorder, node, current_validation, config.on_fail)
            if current_validation.passed:
                recovered = StepOutcome(
                    node=node,
                    status=StepStatus.RECOVERED,
                    result=revalidated.result,
                    attempts_used=round_number + 1,
                    first_invocation=outcome.first_invocation,
                    recovery="retry_upstream",
                )
                self._finish_step(
                    state,
                    recorder,
                    node,
                    data,
                    recovered,
                    validation=current_validation,
                )
                return _Validated(data=revalidated.result.data, terminal=False)

        failure = ValidationFailed(
            _validation_message(current_validation, node),
            node_id=node.id,
            detail={
                "issues": [issue.model_dump() for issue in current_validation.issues],
                "retry_upstream_rounds": budget,
            },
        )
        failed = StepOutcome(
            node=node,
            status=StepStatus.FAILED,
            attempts_used=budget + 1,
            first_invocation=outcome.first_invocation,
            error=failure,
        )
        self._finish_step(
            state, recorder, node, data, failed, validation=current_validation
        )
        self._fail_run(state, recorder, node, failure)
        return _Validated(data=data, terminal=True)

    async def _repair_upstream(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        step_input: Any,
        outcome: StepOutcome,
        anchor: _Anchor,
        validation: ValidationResult,
        config: ValidatorConfig,
    ) -> _Validated:
        """Send the rejected answer back to the AI step with the problems listed.

        Unlike ``retry_upstream`` (which asks the same question again), a repair
        round hands the model its previous output and every validation issue, so
        it can correct exactly what was wrong. Each round is a new invocation of
        the upstream step, so staged failures count it like any other attempt.
        """
        single = GuardPolicy(
            nodes=[], retry=None, timeout=anchor.policy.timeout, fallback=None
        )
        rounds = config.max_repairs
        current_validation = validation
        data = step_input

        for round_number in range(1, rounds + 1):
            previous_output, output_field = _previous_output(anchor.node, data)
            issues = [issue.model_dump() for issue in current_validation.issues]
            request = RepairRequest(
                previous_output=previous_output,
                issues=list(current_validation.issues),
                round=round_number,
                max_rounds=rounds,
                instruction=config.repair_prompt,
                output_field=output_field,
            )
            recorder.emit(
                EventType.STEP_REPAIRING,
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=StepStatus.RETRYING,
                payload={
                    "recovery_action": "repair",
                    "upstream_node_id": anchor.node.id,
                    "upstream_node_label": anchor.node.display_label,
                    "round": round_number,
                    "max_rounds": rounds,
                    "issues": issues,
                    "previous_output": previous_output,
                    "output_field": output_field,
                },
            )
            upstream = await self._execute_step(
                state, recorder, anchor.node, anchor.input, single, repair=request
            )
            if not upstream.failed:
                upstream.status = StepStatus.RECOVERED
                upstream.recovery = "repair"
                if upstream.result is not None:
                    upstream.result.meta["repair"] = {
                        "round": round_number,
                        "issues": issues,
                    }
            self._finish_step(state, recorder, anchor.node, anchor.input, upstream)
            if upstream.failed:
                self._fail_run(state, recorder, anchor.node, upstream.error)
                return _Validated(data=data, terminal=True)

            if upstream.result is None:  # a non-failed outcome carries a result
                raise RuntimeError(
                    f"Repair of {anchor.node.id!r} reported success without a result."
                )
            data = upstream.result.data
            state.data = data

            revalidated = await self._execute_step(state, recorder, node, data, GuardPolicy())
            if revalidated.failed:
                self._finish_step(state, recorder, node, data, revalidated)
                self._fail_run(state, recorder, node, revalidated.error)
                return _Validated(data=data, terminal=True)

            if revalidated.result is None:  # a non-failed outcome carries a result
                raise RuntimeError(
                    f"Re-validation of {node.id!r} reported success without a result."
                )
            current_validation = revalidated.result.validation or ValidationResult(
                passed=True
            )
            self._emit_validation(recorder, node, current_validation, config.on_fail)
            if current_validation.passed:
                revalidated.result.meta.update(
                    repairs_used=round_number,
                    upstream_node_id=anchor.node.id,
                    upstream_node_label=anchor.node.display_label,
                )
                recovered = StepOutcome(
                    node=node,
                    status=StepStatus.RECOVERED,
                    result=revalidated.result,
                    attempts_used=round_number + 1,
                    first_invocation=outcome.first_invocation,
                    recovery="repair",
                )
                self._finish_step(
                    state,
                    recorder,
                    node,
                    data,
                    recovered,
                    validation=current_validation,
                )
                return _Validated(data=revalidated.result.data, terminal=False)

        failure = ValidationFailed(
            _validation_message(current_validation, node),
            node_id=node.id,
            detail={
                "issues": [issue.model_dump() for issue in current_validation.issues],
                "repairs_used": rounds,
            },
        )
        failed = StepOutcome(
            node=node,
            status=StepStatus.FAILED,
            attempts_used=rounds + 1,
            first_invocation=outcome.first_invocation,
            error=failure,
        )
        self._finish_step(
            state, recorder, node, data, failed, validation=current_validation
        )
        self._fail_run(state, recorder, node, failure)
        return _Validated(data=data, terminal=True)

    def _emit_validation(
        self,
        recorder: TraceRecorder,
        node: NodeDef,
        validation: ValidationResult,
        on_fail: str,
    ) -> None:
        recorder.emit(
            EventType.VALIDATION_RESULT,
            node_id=node.id,
            node_label=node.display_label,
            node_type=node.type,
            status=StepStatus.RUNNING,
            payload={
                "passed": validation.passed,
                "issues": [issue.model_dump() for issue in validation.issues],
                "confidence": validation.confidence,
                "checked_fields": validation.checked_fields,
                "on_fail": on_fail,
            },
        )

    # ------------------------------------------------------- step bookkeeping

    def _finish_step(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        step_input: Any,
        outcome: StepOutcome,
        validation: ValidationResult | None = None,
    ) -> None:
        """Emit a step's terminal event and record its snapshot."""
        output = outcome.result.data if outcome.result is not None else None
        payload: dict[str, Any] = {}
        if outcome.result is not None and outcome.result.meta:
            payload.update(outcome.result.meta)
        payload.update(
            input=step_input,
            output=output,
            attempt=outcome.attempts_used,
            status=outcome.status.value,
        )
        if outcome.recovery:
            payload["recovery_action"] = outcome.recovery
        if validation is not None:
            payload["validation"] = validation.model_dump()
        if outcome.error is not None:
            payload["error"] = outcome.error.to_payload()

        event = {
            StepStatus.COMPLETED: EventType.STEP_COMPLETED,
            StepStatus.RECOVERED: EventType.STEP_RECOVERED,
            StepStatus.FAILED: EventType.STEP_FAILED,
            StepStatus.PAUSED: EventType.REVIEW_REQUESTED,
            StepStatus.SAFELY_STOPPED: EventType.STEP_COMPLETED,
        }.get(outcome.status, EventType.STEP_COMPLETED)

        if outcome.status is StepStatus.PAUSED and outcome.result is not None:
            review = outcome.result.review
            if review is not None:
                payload["review"] = review.model_dump(mode="json")

        recorder.emit(
            event,
            node_id=node.id,
            node_label=node.display_label,
            node_type=node.type,
            status=outcome.status,
            payload=payload,
        )
        state.record(
            StepSnapshot(
                node_id=node.id,
                node_label=node.display_label,
                node_type=node.type,
                status=outcome.status,
                input=step_input,
                output=output,
                attempts=outcome.attempts_used,
                error=outcome.error.to_payload() if outcome.error else None,
                validation=validation,
                finished_at=utcnow(),
            )
        )

    def _update_review_snapshot(
        self,
        state: RunState,
        review: ReviewRequest,
        status: StepStatus,
        data: Any,
        decision: ReviewDecision,
    ) -> None:
        snapshot = state.snapshot_for(review.node_id)
        node = state.workflow.node(review.node_id)
        state.record(
            StepSnapshot(
                node_id=review.node_id,
                node_label=review.node_label,
                node_type=node.type,
                status=status,
                input=snapshot.input if snapshot else review.data,
                output=data,
                attempts=snapshot.attempts if snapshot else 1,
                validation=snapshot.validation if snapshot else None,
                finished_at=utcnow(),
            )
        )
        state.updated_at = utcnow()

    # ------------------------------------------------------- run terminations

    def _pause_run(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef,
        result: BlockResult | None,
        data: Any,
    ) -> RunState:
        review = (result.review if result else None) or ReviewRequest(
            node_id=node.id, node_label=node.display_label, data=data
        )
        review.resume_node_id = self._next_node_id(state.workflow, node)
        state.pending_review = review
        state.status = RunStatus.PAUSED
        state.current_node = node.id
        state.data = data
        # ``_finish_step`` already emitted ``review_requested`` for the paused step.
        recorder.emit(
            EventType.RUN_PAUSED,
            node_id=node.id,
            node_label=node.display_label,
            node_type=node.type,
            status=StepStatus.PAUSED,
            payload={"review": review.model_dump(mode="json")},
        )
        return self.store.save(state)

    async def _handle_rejection(
        self,
        state: RunState,
        recorder: TraceRecorder,
        review: ReviewRequest,
        decision: ReviewDecision,
    ) -> RunState:
        """A reviewer said no: route to the safe stop and carry their note."""
        state.stop_note = decision.note
        self._update_review_snapshot(
            state, review, StepStatus.COMPLETED, review.data, decision
        )
        recorder.emit(
            EventType.RUN_RESUMED,
            node_id=review.node_id,
            node_label=review.node_label,
            status=StepStatus.RUNNING,
            payload={"action": "reject", "note": decision.note},
        )
        safe_stops = state.workflow.nodes_of_type(BlockType.SAFE_STOP)
        if safe_stops:
            return await self._drive(state, recorder, safe_stops[0].id, review.data)

        message = "A reviewer rejected this result, so the workflow stopped safely."
        return self._safe_stop_run(state, recorder, None, None, review.data, message)

    def _safe_stop_run(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef | None,
        result: BlockResult | None,
        data: Any,
        message: str | None = None,
    ) -> RunState:
        explanation = message or (result.message if result else None) or DEFAULT_STOP_MESSAGE
        if state.stop_note:
            explanation = f"{explanation} Reviewer note: {state.stop_note}"
        state.status = RunStatus.SAFELY_STOPPED
        state.result = data
        state.finished_at = utcnow()
        recorder.emit(
            EventType.RUN_SAFE_STOPPED,
            node_id=node.id if node else None,
            node_label=node.display_label if node else None,
            node_type=node.type if node else None,
            status=StepStatus.SAFELY_STOPPED,
            payload={"explanation": explanation, "data": data, "note": state.stop_note},
        )
        return self.store.save(state)

    def _complete_run(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef | None,
        data: Any,
    ) -> RunState:
        state.status = RunStatus.COMPLETED
        state.result = data
        state.finished_at = utcnow()
        recorder.emit(
            EventType.RUN_COMPLETED,
            node_id=node.id if node else None,
            node_label=node.display_label if node else None,
            node_type=node.type if node else None,
            status=StepStatus.COMPLETED,
            payload={"result": data},
        )
        return self.store.save(state)

    def _fail_run(
        self,
        state: RunState,
        recorder: TraceRecorder,
        node: NodeDef | None,
        error: StepExecutionError | None,
    ) -> RunState:
        payload = (
            error.to_payload()
            if error
            else {"kind": "step_error", "message": "The step failed."}
        )
        state.status = RunStatus.FAILED
        state.error = payload
        state.finished_at = utcnow()
        recorder.emit(
            EventType.RUN_FAILED,
            node_id=node.id if node else None,
            node_label=node.display_label if node else None,
            node_type=node.type if node else None,
            status=StepStatus.FAILED,
            payload={"error": payload, "failed_node_id": node.id if node else None},
        )
        return self.store.save(state)


# --------------------------------------------------------------- injection


def _plan_error(plan: FailurePlan, node: NodeDef) -> StepExecutionError:
    """Turn a staged failure into the typed exception the engine reacts to."""
    detail = dict(plan.detail)
    message = detail.pop("message", None)
    if plan.kind is FailureKind.TIMEOUT:
        return StepTimeout(
            message or f"{node.display_label} timed out.",
            node_id=node.id,
            detail=detail,
        )
    if plan.kind is FailureKind.INVALID_JSON:
        return InvalidOutputError(
            message or f"{node.display_label} returned output that could not be parsed.",
            node_id=node.id,
            detail=detail,
        )
    if plan.kind is FailureKind.TOOL_ERROR:
        return ToolFailure(
            message or f"{node.display_label} could not reach the tool.",
            node_id=node.id,
            detail=detail,
        )
    return ModelFailure(
        message or f"{node.display_label} could not reach the model provider.",
        node_id=node.id,
        detail=detail,
    )


def _degrade(plan: FailurePlan, result: BlockResult, node: NodeDef) -> BlockResult:
    """Apply a non-raising staged failure by degrading the step's output."""
    detail = plan.detail
    if plan.kind is FailureKind.MISSING_FIELD:
        field_name = detail.get("field", "")
        if field_name:
            result.data = drop_path(result.data, field_name)
        result.meta["injected_failure"] = {"kind": plan.kind.value, "field": field_name}
    elif plan.kind is FailureKind.EMPTY_RETRIEVAL:
        field_name = detail.get("field", "documents")
        count_field = detail.get("count_field", "document_count")
        result.data = set_path(result.data, field_name, [])
        if count_field:
            result.data = set_path(result.data, count_field, 0)
        result.meta.update(document_count=0, documents=[])
        result.meta["injected_failure"] = {"kind": plan.kind.value}
    elif plan.kind is FailureKind.LOW_CONFIDENCE:
        confidence = float(detail.get("confidence", 0.2))
        result.confidence = confidence
        result.meta["confidence"] = confidence
        if isinstance(result.data, dict) and "confidence" in result.data:
            result.data = set_path(result.data, "confidence", confidence)
        result.meta["injected_failure"] = {"kind": plan.kind.value}
    return result


def _previous_output(node: NodeDef, data: Any) -> tuple[Any, str | None]:
    """The AI step's own answer inside ``data``, plus the field it was stored under.

    When the step has no ``output_field`` its answer *is* the data.
    """
    try:
        config = get_block(BlockType.AI_MODEL).parse_config(node)
    except ValidationError:
        return data, None
    output_field = getattr(config, "output_field", None)
    if not output_field:
        return data, None
    value = get_path(data, output_field, MISSING)
    return (None if value is MISSING else value), output_field


def _validation_message(validation: ValidationResult, node: NodeDef) -> str:
    if not validation.issues:
        return f"{node.display_label} rejected the data."
    return "; ".join(issue.message for issue in validation.issues)
