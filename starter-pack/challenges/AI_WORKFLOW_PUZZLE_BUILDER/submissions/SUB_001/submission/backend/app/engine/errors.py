"""Typed engine exceptions.

Responsibility: give every failure a stable ``kind`` string so the trace, the API
layer and the UI can talk about failures without string-matching messages.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - typing only
    from app.engine.graph import GraphValidationReport


class EngineError(Exception):
    """Base class for every error raised by the workflow engine."""


class RunNotFound(EngineError):
    """Raised when a run id is unknown to the store."""


class InvalidRunState(EngineError):
    """Raised when an operation does not match the run's current status."""


class WorkflowValidationError(EngineError):
    """Raised when a workflow graph cannot be executed.

    Carries the full structured report so callers can render every issue.
    """

    def __init__(self, report: GraphValidationReport) -> None:
        self.report = report
        summary = "; ".join(issue.message for issue in report.errors) or "invalid workflow"
        super().__init__(summary)


class StepExecutionError(EngineError):
    """Base class for failures raised while executing a single step.

    Subclasses set ``kind``; the engine copies it into the trace error payload.
    """

    kind = "step_error"

    def __init__(
        self,
        message: str,
        *,
        node_id: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.node_id = node_id
        self.detail: dict[str, Any] = detail or {}

    def to_payload(self) -> dict[str, Any]:
        """JSON-serialisable ``{kind, message, ...}`` block for trace payloads."""
        payload: dict[str, Any] = {"kind": self.kind, "message": self.message}
        if self.node_id is not None:
            payload["node_id"] = self.node_id
        if self.detail:
            payload["detail"] = self.detail
        return payload


class StepTimeout(StepExecutionError):
    """A step exceeded the timeout guard's budget."""

    kind = "timeout"


class InvalidOutputError(StepExecutionError):
    """A step produced output that could not be parsed / used (e.g. invalid JSON)."""

    kind = "invalid_output"


class ModelFailure(StepExecutionError):
    """The model port failed (provider error, refusal, transport error)."""

    kind = "model_error"


class ToolFailure(StepExecutionError):
    """The tool port failed."""

    kind = "tool_error"


class RetrievalFailure(StepExecutionError):
    """The retrieval port failed."""

    kind = "retrieval_error"


class ValidationFailed(StepExecutionError):
    """A validator block failed and its ``on_fail`` policy is ``fail``."""

    kind = "validation_failed"


class ConfigurationError(StepExecutionError):
    """A block's config is missing or malformed at execution time."""

    kind = "configuration_error"


class ReviewRejected(StepExecutionError):
    """A human reviewer rejected the run and no safe stop block was reachable."""

    kind = "review_rejected"
