"""Run state and run-scoped result artifacts.

Responsibility: everything about *one execution* of a workflow - its status, the
data snapshot of every step, its trace, and any review it is waiting on. This is
the object that gets persisted, streamed and resumed.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.engine.model import BlockType, WorkflowDef
from app.engine.trace import StepStatus, TraceEvent, utcnow


class RunStatus(StrEnum):
    """Lifecycle status of a whole run."""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    SAFELY_STOPPED = "safely_stopped"


TERMINAL_RUN_STATUSES: frozenset[RunStatus] = frozenset(
    {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.SAFELY_STOPPED}
)

#: What a reviewer may do with a paused run, unless a block narrows the list.
REVIEW_ACTIONS: tuple[str, ...] = ("approve", "edit", "reject")


def _default_review_actions() -> list[str]:
    """A fresh mutable copy of :data:`REVIEW_ACTIONS` for each ReviewRequest."""
    return list(REVIEW_ACTIONS)


class ValidationIssue(BaseModel):
    """One problem found by a validator block."""

    field: str | None = None
    code: str
    message: str
    expected: Any = None
    actual: Any = None


class ValidationResult(BaseModel):
    """Structured outcome of a validator block, recorded in the trace."""

    passed: bool
    issues: list[ValidationIssue] = Field(default_factory=list)
    confidence: float | None = None
    checked_fields: list[str] = Field(default_factory=list)

    @property
    def issue_codes(self) -> list[str]:
        return [issue.code for issue in self.issues]


class RepairRequest(BaseModel):
    """What a validator sends back to the AI step when ``on_fail`` is ``repair``.

    The AI Model block attaches this to the prompt config it hands the model port,
    so a live provider can quote the rejected answer and the problems found, and
    the mock provider can serve the committed repaired answer.
    """

    previous_output: Any = None
    issues: list[ValidationIssue] = Field(default_factory=list)
    round: int = 1
    max_rounds: int = 1
    instruction: str | None = None
    #: The dotted field the previous answer was stored under, when the step has one.
    output_field: str | None = None


class StepSnapshot(BaseModel):
    """The recorded input/output/status of one step of a run."""

    node_id: str
    node_label: str
    node_type: BlockType
    status: StepStatus
    input: Any = None
    output: Any = None
    attempts: int = 0
    error: dict[str, Any] | None = None
    validation: ValidationResult | None = None
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None
    reused_from: str | None = None


class ReviewRequest(BaseModel):
    """The payload a paused run hands to a human reviewer."""

    node_id: str
    node_label: str
    prompt: str = "Review the data below before the workflow continues."
    data: Any = None
    allowed_actions: list[str] = Field(default_factory=_default_review_actions)
    validation: ValidationResult | None = None
    #: Node the run continues from once a decision arrives.
    resume_node_id: str | None = None
    requested_at: datetime = Field(default_factory=utcnow)


class ReviewDecision(BaseModel):
    """A reviewer's answer to a :class:`ReviewRequest`."""

    action: Literal["approve", "edit", "reject"]
    edited_data: Any = None
    note: str | None = None


class RunState(BaseModel):
    """Everything known about one execution of a workflow."""

    run_id: str
    workflow: WorkflowDef
    status: RunStatus = RunStatus.RUNNING
    current_node: str | None = None
    input: Any = None
    data: Any = None
    result: Any = None
    error: dict[str, Any] | None = None
    scenario_id: str | None = None
    snapshots: dict[str, StepSnapshot] = Field(default_factory=dict)
    step_order: list[str] = Field(default_factory=list)
    trace: list[TraceEvent] = Field(default_factory=list)
    pending_review: ReviewRequest | None = None
    review_decisions: list[ReviewDecision] = Field(default_factory=list)
    stop_note: str | None = None
    #: Confidence reported by the most recent model call, used by validators.
    last_confidence: float | None = None
    #: Per-node cumulative invocation counter, handed to the failure injector.
    attempts: dict[str, int] = Field(default_factory=dict)
    resumed_from: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None

    def record(self, snapshot: StepSnapshot) -> None:
        """Store (or replace) a step snapshot, preserving first-seen order."""
        if snapshot.node_id not in self.snapshots:
            self.step_order.append(snapshot.node_id)
        self.snapshots[snapshot.node_id] = snapshot
        self.updated_at = utcnow()

    def next_attempt(self, node_id: str) -> int:
        """Increment and return the cumulative invocation count for ``node_id``."""
        count = self.attempts.get(node_id, 0) + 1
        self.attempts[node_id] = count
        return count

    @property
    def is_finished(self) -> bool:
        return self.status in TERMINAL_RUN_STATUSES

    def snapshot_for(self, node_id: str) -> StepSnapshot | None:
        return self.snapshots.get(node_id)
