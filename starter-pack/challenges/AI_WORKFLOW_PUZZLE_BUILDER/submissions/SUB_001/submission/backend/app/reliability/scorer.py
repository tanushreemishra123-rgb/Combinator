"""Post-run reliability scoring.

Responsibility: read a finished run's trace and snapshots and answer the only
question the feedback screen really asks - *would you trust this workflow?* -
in the exact ``ReliabilityReport`` shape the frontend expects (``frontend/src/api/types.ts``).

Everything here is derived from the recorded run. Nothing is measured while the
run executes, so a report can be recomputed from a stored run forever.

Grades
------
``broken``
    The run failed, or ended carrying an unhandled error.
``fragile``
    It finished, but for the wrong reasons: the staged failure was never
    handled, the output failed validation with nobody to vouch for it, it
    stopped safely without reaching the puzzle's goal, or nothing in the
    workflow checks or protects the AI at all.
``recovered``
    It finished, but only because something rescued it - and there is still a
    soft spot: a low-confidence answer a human had to bless, or a backup
    provider that stood in for the model you designed around.
``resilient``
    It finished (or stopped safely on purpose), the staged failure was handled,
    the output validated, and nothing was left unhandled.

The score is a 0-100 weighted sum: outcome (30), handling the injected failure
(20), output validity (15), how well the workflow is checked and protected (15)
and the puzzle's completion criteria (20), minus 15 for an unhandled error and 6
per soft spot.

Completion DSL
--------------
Each puzzle commits ``completion_checks``, evaluated in order against the run
and paired 1:1 with the human-readable ``completion_criteria``. Seven kinds:

``{"kind": "run_status", "in": ["completed", "safely_stopped"]}``
    The run ended in one of these statuses.
``{"kind": "block_used", "type": "retry"}``
    The workflow contains a block of this type *and* the run actually executed
    it (a guard the player never wired up cannot pass this).
``{"kind": "event", "event": "review_decision", "node_id": "..."}``
    At least one trace event of this type (optionally on one node).
``{"kind": "recovered", "node_id": "fetch_archive", "recovery_action": ["repair"]}``
    That node (or any node, when ``node_id`` is omitted) came back from a
    failure: a ``step_recovered``/``fallback_used`` event or a ``recovered``
    snapshot status. With ``recovery_action`` set, only events whose
    ``recovery_action`` is in the list count (and snapshots are not consulted).
``{"kind": "output_field", "field": "a.b", "op": "eq|exists|not_empty|contains", "value": ...}``
    A dotted path into the run's final result satisfies the comparison.
``{"kind": "resumed", "min_skipped": 3}``
    The run was resumed from an earlier one, reusing at least this many steps.
``{"kind": "validation_passed", "node_id": "check_record"}``
    The last validation recorded for that validator (or for any validator)
    passed.

Adding a kind means adding it to :data:`_CHECKS` here *and* to
``CheckKind`` in :mod:`app.puzzles.models`, which is what keeps a typo in a seed
file from silently passing.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.blocks.base import MISSING, get_path
from app.engine.model import GUARD_TYPES, BlockType, WorkflowDef
from app.engine.run import RunState, RunStatus
from app.engine.trace import EventType, StepStatus, TraceEvent
from app.puzzles.models import CompletionCheck, Puzzle

Grade = Literal["resilient", "recovered", "fragile", "broken"]

#: Weights of the five scoring components; they sum to 100.
WEIGHT_OUTCOME = 30
WEIGHT_HANDLED = 20
WEIGHT_OUTPUT = 15
WEIGHT_DESIGN = 15
WEIGHT_COMPLETION = 20

PENALTY_UNHANDLED = 15
PENALTY_SOFT_SPOT = 6

#: Friendly names used in the sentences shown to the player.
_ERROR_NAMES = {
    "timeout": "timeout",
    "invalid_output": "unreadable answer",
    "model_error": "model outage",
    "tool_error": "tool failure",
    "retrieval_error": "search failure",
    "validation_failed": "failed validation",
    "configuration_error": "misconfigured block",
    "step_error": "step failure",
}


class CompletionOutcome(BaseModel):
    """One completion criterion and whether this run met it."""

    criterion: str
    met: bool


class ReliabilityReport(BaseModel):
    """The feedback screen's payload - the frozen contract shape."""

    run_id: str
    puzzle_id: str | None = None
    grade: Grade
    score: int
    completed: bool
    output_valid: bool | None = None
    injected_failure_handled: bool | None = None
    retries_used: int = 0
    #: Validator repair rounds (an answer sent back to the model with its problems).
    repairs_used: int = 0
    fallback_used: bool = False
    human_review_used: bool = False
    safe_stop_used: bool = False
    unhandled_errors: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    completion: list[CompletionOutcome] = Field(default_factory=list)
    puzzle_solved: bool = False


# --------------------------------------------------------------------- signals


class _Signals:
    """Everything the report needs, read once out of the run."""

    def __init__(self, state: RunState) -> None:
        self.state = state
        self.workflow: WorkflowDef = state.workflow
        self.trace: list[TraceEvent] = list(state.trace)

        self.retrying = self._of(EventType.STEP_RETRYING)
        self.repairs = self._of(EventType.STEP_REPAIRING)
        self.recovered = self._of(EventType.STEP_RECOVERED)
        self.fallbacks = self._of(EventType.FALLBACK_USED)
        self.decisions = self._of(EventType.REVIEW_DECISION)
        self.reviews = self._of(EventType.REVIEW_REQUESTED)
        self.skipped = self._of(EventType.STEP_SKIPPED)
        self.validations = self._of(EventType.VALIDATION_RESULT)
        self.failures = self._of(EventType.RUN_FAILED)
        self.safe_stops = self._of(EventType.RUN_SAFE_STOPPED)

        self.retries_used = len(self.retrying)
        self.repairs_used = len(self.repairs)
        self.fallback_used = bool(self.fallbacks)
        self.human_review_used = bool(self.decisions)
        self.safe_stop_used = (
            state.status is RunStatus.SAFELY_STOPPED or bool(self.safe_stops)
        )
        self.resumed = state.resumed_from is not None
        self.completed = state.status is RunStatus.COMPLETED

    def _of(self, event: EventType, node_id: str | None = None) -> list[TraceEvent]:
        return [
            item
            for item in self.trace
            if item.event is event and (node_id is None or item.node_id == node_id)
        ]

    # ------------------------------------------------------------- properties

    @property
    def unhandled_errors(self) -> list[str]:
        """Error kinds the run ended on, in order (empty for a healthy run)."""
        kinds: list[str] = []
        for item in self.failures:
            error = item.payload.get("error") or {}
            kind = str(error.get("kind") or "step_error")
            if kind not in kinds:
                kinds.append(kind)
        if not kinds and self.state.error:
            kinds.append(str(self.state.error.get("kind") or "step_error"))
        return kinds

    @property
    def output_valid(self) -> bool | None:
        """Did the last validator to speak say yes? ``None`` when none ran."""
        if not self.validations:
            return None
        return bool(self.validations[-1].payload.get("passed"))

    @property
    def rescue_used(self) -> bool:
        """Did anything actively save this run?"""
        return bool(
            self.retries_used
            or self.repairs_used
            or self.fallback_used
            or self.human_review_used
            or self.safe_stop_used
            or self.resumed
            or self.recovered
        )

    @property
    def low_confidence_issues(self) -> list[dict[str, Any]]:
        """Every ``low_confidence`` validation issue recorded on this run."""
        found: list[dict[str, Any]] = []
        for item in self.validations:
            for issue in item.payload.get("issues") or []:
                if isinstance(issue, dict) and issue.get("code") == "low_confidence":
                    found.append(issue)
        return found

    @property
    def node_types(self) -> set[BlockType]:
        return {node.type for node in self.workflow.nodes}

    def has_reachable_safe_stop(self) -> bool:
        """A Safe Stop only protects a workflow once something can route to it."""
        return any(
            node.type is BlockType.SAFE_STOP and self.workflow.incoming(node.id)
            for node in self.workflow.nodes
        )

    def has_active_validator(self) -> bool:
        """A Validator whose on-fail policy does something other than give up."""
        return any(
            node.type is BlockType.VALIDATOR
            and str((node.config or {}).get("on_fail", "fail")) != "fail"
            for node in self.workflow.nodes
        )

    def executed(self, block_type: BlockType) -> bool:
        """Did the run actually run a block of this type?"""
        return any(
            snapshot.node_type is block_type for snapshot in self.state.snapshots.values()
        )

    def error_before(self, node_id: str, seq: int) -> str | None:
        """The error kind recorded for ``node_id`` just before ``seq`` (for strengths)."""
        kind: str | None = None
        for item in self.trace:
            if item.seq >= seq:
                break
            if item.node_id != node_id:
                continue
            error = item.payload.get("error")
            if isinstance(error, dict) and error.get("kind"):
                kind = str(error["kind"])
        return kind


# --------------------------------------------------------------- completion DSL


def _check_run_status(check: CompletionCheck, signals: _Signals) -> bool:
    return signals.state.status.value in set(check.statuses or [])


def _check_block_used(check: CompletionCheck, signals: _Signals) -> bool:
    if check.type is None:
        raise ValueError("A 'block_used' completion check needs a block 'type'.")
    if not any(node.type is check.type for node in signals.workflow.nodes):
        return False
    return signals.executed(check.type)


def _check_event(check: CompletionCheck, signals: _Signals) -> bool:
    if check.event is None:
        raise ValueError("An 'event' completion check needs an 'event' name.")
    return bool(signals._of(check.event, check.node_id))


def _check_recovered(check: CompletionCheck, signals: _Signals) -> bool:
    for item in signals.recovered + signals.fallbacks:
        if check.node_id is not None and item.node_id != check.node_id:
            continue
        if check.recovery_action is not None:
            if str(item.payload.get("recovery_action") or "") in check.recovery_action:
                return True
            continue
        return True
    if check.recovery_action is not None:
        return False  # a narrowed check trusts the trace, not the snapshot status
    for snapshot in signals.state.snapshots.values():
        if check.node_id is not None and snapshot.node_id != check.node_id:
            continue
        if snapshot.status is StepStatus.RECOVERED:
            return True
    return False


def _check_output_field(check: CompletionCheck, signals: _Signals) -> bool:
    if check.field is None:
        raise ValueError("An 'output_field' completion check needs a 'field' path.")
    value = get_path(signals.state.result, check.field, MISSING)
    if check.op == "exists":
        return value is not MISSING and value is not None
    if value is MISSING:
        return False
    if check.op == "eq":
        return value == check.value
    if check.op == "not_empty":
        if value is None:
            return False
        if isinstance(value, (str, list, tuple, dict, set)):
            return len(value) > 0
        return True
    # contains
    if isinstance(value, str):
        return str(check.value).lower() in value.lower()
    if isinstance(value, (list, tuple, set)):
        return check.value in value
    return False


def _check_resumed(check: CompletionCheck, signals: _Signals) -> bool:
    if not signals.resumed:
        return False
    return len(signals.skipped) >= (check.min_skipped or 0)


def _check_validation_passed(check: CompletionCheck, signals: _Signals) -> bool:
    relevant = [
        item
        for item in signals.validations
        if check.node_id is None or item.node_id == check.node_id
    ]
    if not relevant:
        return False
    return bool(relevant[-1].payload.get("passed"))


_CHECKS: dict[str, Callable[[CompletionCheck, _Signals], bool]] = {
    "run_status": _check_run_status,
    "block_used": _check_block_used,
    "event": _check_event,
    "recovered": _check_recovered,
    "output_field": _check_output_field,
    "resumed": _check_resumed,
    "validation_passed": _check_validation_passed,
}


def evaluate_check(check: CompletionCheck, state: RunState) -> bool:
    """Evaluate one completion check against a run (exposed for tests/tooling)."""
    return _CHECKS[check.kind](check, _Signals(state))


def _completion(
    puzzle: Puzzle | None, signals: _Signals
) -> tuple[list[CompletionOutcome], bool]:
    if puzzle is None:
        return [], True
    outcomes = [
        CompletionOutcome(criterion=criterion, met=_CHECKS[check.kind](check, signals))
        for criterion, check in zip(puzzle.completion_criteria, puzzle.completion_checks, strict=False)
    ]
    return outcomes, all(item.met for item in outcomes)


# ------------------------------------------------------------------- narrative


def _strengths(signals: _Signals) -> list[str]:
    """Friendly sentences about what actually went right, citing real events."""
    said: list[str] = []

    for item in signals.recovered:
        attempt = item.payload.get("attempt")
        action = str(item.payload.get("recovery_action") or "")
        label = item.node_label or item.node_id or "a step"
        kind = _ERROR_NAMES.get(signals.error_before(item.node_id or "", item.seq) or "", "")
        if action == "retry" and attempt:
            trouble = f" from a {kind}" if kind else ""
            said.append(f"Recovered{trouble} on attempt {attempt} of {label}.")
        elif action == "retry_upstream":
            said.append(
                f"{label} caught the bad result and re-ran the previous step until it was right."
            )
        elif action == "repair":
            # Both the validator and the repaired AI step carry this action;
            # only the validator's event (the one with repairs_used) speaks.
            rounds = item.payload.get("repairs_used")
            if not rounds:
                continue
            upstream = item.payload.get("upstream_node_label") or "the previous step"
            said.append(
                f"{label} sent the answer back to {upstream} with the problems spelled out, "
                "and the corrected answer passed."
            )
        elif action == "validator_safe_default":
            said.append(f"{label} swapped in a safe default rather than shipping bad data.")
        elif action.startswith("fallback"):
            continue  # covered by the fallback sentence below
        else:
            said.append(f"{label} came back from a failure and the run carried on.")

    for item in signals.fallbacks:
        label = item.node_label or item.node_id or "the step"
        if item.payload.get("mode") == "alternate_provider":
            provider = item.payload.get("provider") or "the backup provider"
            said.append(
                f"The backup provider ({provider}) wrote the answer for {label} when the "
                "main one was down."
            )
        else:
            said.append(f"A safe default kept {label} moving after every attempt failed.")

    for item in signals.decisions:
        action = str(item.payload.get("action") or "reviewed")
        label = item.node_label or "the result"
        verb = {"approve": "approved", "edit": "corrected", "reject": "rejected"}.get(
            action, "reviewed"
        )
        said.append(f"A person {verb} {label} before the workflow went any further.")

    if signals.state.status is RunStatus.SAFELY_STOPPED:
        explanation = ""
        if signals.safe_stops:
            explanation = str(signals.safe_stops[-1].payload.get("explanation") or "")
        said.append(
            explanation
            or "The workflow stopped safely instead of shipping something it could not stand behind."
        )

    if signals.resumed:
        said.append(
            f"Resumed from the last successful step and reused {len(signals.skipped)} "
            "finished steps instead of starting over."
        )

    caught = [
        item
        for item in signals.validations
        if not item.payload.get("passed") and item.payload.get("issues")
    ]
    if caught and signals.output_valid:
        fields = [
            str(issue.get("field"))
            for issue in caught[0].payload.get("issues") or []
            if isinstance(issue, dict) and issue.get("field")
        ]
        named = f" ({', '.join(fields)})" if fields else ""
        said.append(f"The validator caught the problem{named} before it reached the output.")
    elif signals.output_valid:
        said.append("The final output passed every check the validator makes.")

    if not said and signals.completed:
        said.append("The workflow ran end to end without a single stumble.")
    return said


def _weaknesses(
    signals: _Signals, structural: list[str], soft: list[str]
) -> list[str]:
    said: list[str] = []
    for kind in signals.unhandled_errors:
        node = signals.failures[-1].node_label if signals.failures else None
        where = f" at {node}" if node else ""
        said.append(
            f"The run ended with an unhandled {_ERROR_NAMES.get(kind, kind)}{where}."
        )
    said.extend(soft)
    said.extend(structural)
    return said


def _structural_weaknesses(signals: _Signals) -> list[str]:
    """Design gaps visible in the workflow itself, regardless of what happened."""
    said: list[str] = []
    types = signals.node_types
    checks = (
        BlockType.VALIDATOR in types
        or BlockType.HUMAN_REVIEW in types
        or BlockType.CONDITION in types
        or signals.has_reachable_safe_stop()
    )
    if BlockType.AI_MODEL in types and not checks:
        said.append(
            "Nothing checks the AI's answer before it ships - add a Validator, a "
            "Condition or a Human Review."
        )
    protected = (
        bool(types & GUARD_TYPES)
        or BlockType.HUMAN_REVIEW in types
        or signals.has_reachable_safe_stop()
        or signals.has_active_validator()
    )
    if not protected:
        said.append(
            "No Retry, Timeout, Fallback or Safe Stop protects this workflow when a "
            "step goes wrong."
        )
    return said


def _soft_weaknesses(signals: _Signals) -> list[str]:
    """Real answers arrived, but not down the path the workflow was designed for."""
    said: list[str] = []
    issues = signals.low_confidence_issues
    if issues:
        issue = issues[-1]
        said.append(
            f"The model's confidence ({issue.get('actual')}) fell below the "
            f"{issue.get('expected')} bar you set, so the answer could not be trusted "
            "on its own."
        )
    for item in signals.fallbacks:
        if item.payload.get("mode") == "alternate_provider":
            said.append(
                "The model you designed around never answered - the result came from "
                "the backup provider."
            )
            break
    if signals.output_valid is False and signals.human_review_used:
        said.append(
            "The result never passed validation on its own; a person had to vouch for it."
        )
    return said


# ----------------------------------------------------------------------- grade


def _grade(
    signals: _Signals,
    *,
    handled: bool | None,
    goal_met: bool,
    structural: list[str],
    soft: list[str],
) -> Grade:
    if signals.state.status is RunStatus.FAILED or signals.unhandled_errors:
        return "broken"
    if handled is False:
        return "fragile"
    if signals.output_valid is False and not signals.rescue_used:
        return "fragile"
    if signals.state.status is RunStatus.SAFELY_STOPPED and not goal_met:
        return "fragile"
    if structural and not (signals.rescue_used or handled):
        return "fragile"
    if signals.rescue_used and (soft or not goal_met):
        return "recovered"
    if soft or structural:
        return "recovered" if signals.rescue_used else "fragile"
    return "resilient"


def _score(
    signals: _Signals,
    *,
    handled: bool | None,
    goal_met: bool,
    completion: list[CompletionOutcome],
    structural: list[str],
    soft: list[str],
) -> int:
    status = signals.state.status
    if status is RunStatus.COMPLETED:
        outcome = WEIGHT_OUTCOME
    elif status is RunStatus.SAFELY_STOPPED:
        outcome = WEIGHT_OUTCOME if goal_met else 12
    elif status is RunStatus.PAUSED:
        outcome = 5
    else:
        outcome = 0

    if handled is True:
        handling = WEIGHT_HANDLED
    elif handled is None:
        handling = 14
    else:
        handling = 0

    valid = signals.output_valid
    if valid is True:
        output = WEIGHT_OUTPUT
    elif valid is None or signals.human_review_used:
        output = 8
    else:
        output = 0

    design = WEIGHT_DESIGN - min(len(structural), 2) * (WEIGHT_DESIGN // 2)

    if completion:
        met = sum(1 for item in completion if item.met)
        criteria = round(WEIGHT_COMPLETION * met / len(completion))
    else:
        criteria = WEIGHT_COMPLETION

    total = outcome + handling + output + design + criteria
    if signals.unhandled_errors:
        total -= PENALTY_UNHANDLED
    total -= PENALTY_SOFT_SPOT * len(soft)
    return max(0, min(100, round(total)))


# ------------------------------------------------------------------- entrypoint


def score_run(
    run_state: RunState,
    puzzle: Puzzle | None = None,
    scenario_enabled: bool = False,
) -> ReliabilityReport:
    """Grade one finished run.

    Args:
        run_state: the run to score. A still-running or paused run can be
            scored, but its outcome component reflects that it never finished.
        puzzle: the puzzle it was attempting, when there was one; supplies the
            completion criteria and their checks.
        scenario_enabled: whether a failure scenario was actually staged for
            this run. Drives ``injected_failure_handled``, which is ``None``
            when nothing was injected.
    """
    signals = _Signals(run_state)
    completion, goal_met = _completion(puzzle, signals)

    handled: bool | None = None
    if scenario_enabled:
        ended_well = run_state.status in {RunStatus.COMPLETED, RunStatus.SAFELY_STOPPED}
        handled = bool(ended_well and signals.rescue_used)

    structural = _structural_weaknesses(signals)
    soft = _soft_weaknesses(signals)
    grade = _grade(
        signals, handled=handled, goal_met=goal_met, structural=structural, soft=soft
    )
    score = _score(
        signals,
        handled=handled,
        goal_met=goal_met,
        completion=completion,
        structural=structural,
        soft=soft,
    )

    return ReliabilityReport(
        run_id=run_state.run_id,
        puzzle_id=puzzle.id if puzzle else None,
        grade=grade,
        score=score,
        completed=signals.completed,
        output_valid=signals.output_valid,
        injected_failure_handled=handled,
        retries_used=signals.retries_used,
        repairs_used=signals.repairs_used,
        fallback_used=signals.fallback_used,
        human_review_used=signals.human_review_used,
        safe_stop_used=signals.safe_stop_used,
        unhandled_errors=signals.unhandled_errors,
        strengths=_strengths(signals),
        weaknesses=_weaknesses(signals, structural, soft),
        completion=completion,
        puzzle_solved=bool(puzzle) and goal_met,
    )
