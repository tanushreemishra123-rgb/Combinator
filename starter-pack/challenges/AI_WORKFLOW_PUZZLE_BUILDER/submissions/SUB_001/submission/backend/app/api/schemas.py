"""Request and response models for the HTTP API.

Responsibility: hold the wire shapes the frontend codes against (mirrored in
``frontend/src/api/types.ts``). The engine's own models carry a few extra bookkeeping fields (a review's
``resume_node_id``, a graph issue's ``detail``) that the contract does not
promise, so anything the frontend reads is projected through a model declared
here rather than serialised straight off an engine object.

The one place this file *extends* an internal model is :class:`PuzzleDetailOut`,
which adds the contract's optional ``tools`` list to
:class:`~app.puzzles.models.PuzzleDetail`.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.engine.graph import GraphIssue, GraphValidationReport
from app.engine.model import WorkflowDef
from app.engine.run import (
    ReviewRequest,
    RunState,
    ValidationIssue,
    ValidationResult,
)
from app.engine.trace import TraceEvent
from app.puzzles.models import PuzzleDetail

# ------------------------------------------------------------------- puzzles


class ToolInfo(BaseModel):
    """One simulated tool a Tool block may call in this puzzle."""

    name: str
    description: str


class PuzzleDetailOut(PuzzleDetail):
    """``PuzzleDetail`` plus the tools the canvas offers for ``tool.tool``.

    ``tools`` is omitted entirely (never ``null``) for a puzzle whose palette has
    no Tool block, which is what the contract's ``tools?`` means to the frontend.
    """

    tools: list[ToolInfo] = Field(default_factory=list)


# ---------------------------------------------------------------- validation


class ValidationIssueOut(BaseModel):
    """One structured problem with a workflow graph, contract-shaped."""

    code: str
    message: str
    node_id: str | None = None
    edge_id: str | None = None

    @classmethod
    def of(cls, issue: GraphIssue) -> ValidationIssueOut:
        return cls(
            code=issue.code,
            message=issue.message,
            node_id=issue.node_id,
            edge_id=issue.edge_id,
        )


class WorkflowValidationRequest(BaseModel):
    """``POST /api/workflows/validate`` body."""

    workflow: WorkflowDef


class WorkflowValidationResponse(BaseModel):
    """``{valid, errors[], warnings[]}`` - the builder's "check workflow" answer."""

    valid: bool
    errors: list[ValidationIssueOut] = Field(default_factory=list)
    warnings: list[ValidationIssueOut] = Field(default_factory=list)

    @classmethod
    def of(cls, report: GraphValidationReport) -> WorkflowValidationResponse:
        return cls(
            valid=report.valid,
            errors=[ValidationIssueOut.of(issue) for issue in report.errors],
            warnings=[ValidationIssueOut.of(issue) for issue in report.warnings],
        )


# --------------------------------------------------------------------- runs


class RunRequest(BaseModel):
    """``POST /api/runs`` body. ``input`` defaults to the puzzle's sample input."""

    workflow: WorkflowDef
    puzzle_id: str | None = None
    scenario_id: str | None = None
    input: Any = None

    @property
    def input_given(self) -> bool:
        """Whether the caller actually sent ``input`` (``null`` counts as sent)."""
        return "input" in self.model_fields_set


class ReviewDecisionRequest(BaseModel):
    """``POST /api/runs/{run_id}/review`` body."""

    action: Literal["approve", "edit", "reject"]
    edited_data: Any = None
    note: str | None = None


class RunAccepted(BaseModel):
    """``202`` acknowledgement: the run id to stream events from."""

    run_id: str


class ValidationOut(BaseModel):
    """A validator's verdict as the contract states it: ``{passed, issues[]}``."""

    passed: bool
    issues: list[ValidationIssue] = Field(default_factory=list)

    @classmethod
    def of(cls, result: ValidationResult | None) -> ValidationOut | None:
        if result is None:
            return None
        return cls(passed=result.passed, issues=list(result.issues))


class ReviewRequestOut(BaseModel):
    """What a paused run is waiting for, contract-shaped."""

    node_id: str
    node_label: str
    prompt: str
    data: Any = None
    allowed_actions: list[str] = Field(default_factory=list)
    validation: ValidationOut | None = None

    @classmethod
    def of(cls, review: ReviewRequest | None) -> ReviewRequestOut | None:
        if review is None:
            return None
        return cls(
            node_id=review.node_id,
            node_label=review.node_label,
            prompt=review.prompt,
            data=review.data,
            allowed_actions=list(review.allowed_actions),
            validation=ValidationOut.of(review.validation),
        )


class RunSummary(BaseModel):
    """Everything the run screen needs, including the full trace.

    ``puzzle_id`` is not part of the engine's :class:`RunState` - the run
    registry remembers which puzzle a run belongs to and it is merged in here.
    """

    run_id: str
    puzzle_id: str | None = None
    status: str
    scenario_id: str | None = None
    result: Any = None
    error: dict[str, Any] | None = None
    pending_review: ReviewRequestOut | None = None
    resumed_from: str | None = None
    trace: list[TraceEvent] = Field(default_factory=list)

    @classmethod
    def of(cls, state: RunState, puzzle_id: str | None) -> RunSummary:
        return cls(
            run_id=state.run_id,
            puzzle_id=puzzle_id,
            status=state.status.value,
            scenario_id=state.scenario_id,
            result=state.result,
            error=state.error,
            pending_review=ReviewRequestOut.of(state.pending_review),
            resumed_from=state.resumed_from,
            trace=list(state.trace),
        )
