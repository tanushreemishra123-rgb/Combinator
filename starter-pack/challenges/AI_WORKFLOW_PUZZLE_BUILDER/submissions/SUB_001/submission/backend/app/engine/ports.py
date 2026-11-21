"""Ports (seams) the engine executes against.

Responsibility: define the narrow protocols that separate *orchestration* (this
package) from *capability* (providers, tools, retrieval, failure injection - Task 3).
The engine never imports a concrete provider; it only ever sees these protocols.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class ModelResult(BaseModel):
    """What a model provider returns for one call."""

    data: Any = None
    confidence: float | None = None
    raw: str = ""
    provider_used: str = "mock"
    mocked: bool = True


class FailureKind(StrEnum):
    """The deterministic failure scenarios the engine knows how to stage."""

    TIMEOUT = "timeout"
    INVALID_JSON = "invalid_json"
    MISSING_FIELD = "missing_field"
    TOOL_ERROR = "tool_error"
    EMPTY_RETRIEVAL = "empty_retrieval"
    LOW_CONFIDENCE = "low_confidence"
    MODEL_ERROR = "model_error"


#: Kinds that abort the step before it runs (the engine raises a typed exception).
RAISING_KINDS: frozenset[FailureKind] = frozenset(
    {
        FailureKind.TIMEOUT,
        FailureKind.INVALID_JSON,
        FailureKind.TOOL_ERROR,
        FailureKind.MODEL_ERROR,
    }
)

#: Kinds that let the step run and then degrade its output (so validators can catch them).
DEGRADING_KINDS: frozenset[FailureKind] = frozenset(
    {
        FailureKind.MISSING_FIELD,
        FailureKind.EMPTY_RETRIEVAL,
        FailureKind.LOW_CONFIDENCE,
    }
)


class FailurePlan(BaseModel):
    """A single staged failure, decided deterministically per (node, attempt)."""

    kind: FailureKind
    detail: dict[str, Any] = Field(default_factory=dict)

    @property
    def raises(self) -> bool:
        return self.kind in RAISING_KINDS


@runtime_checkable
class ModelPort(Protocol):
    """Calls an AI model provider."""

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult: ...


@runtime_checkable
class ToolPort(Protocol):
    """Calls a simulated external tool/API."""

    async def call(self, tool_name: str, config: dict[str, Any], data: Any) -> Any: ...


@runtime_checkable
class RetrievalPort(Protocol):
    """Retrieves grounding documents."""

    async def retrieve(
        self, query_config: dict[str, Any], data: Any
    ) -> list[dict[str, Any]]: ...


@runtime_checkable
class FailureInjector(Protocol):
    """Decides, deterministically, whether a step attempt should fail.

    Implementations must be pure functions of ``(run's scenario, node_id, attempt)``
    so a run can be replayed with identical results.
    """

    def should_fail(
        self, run_id: str, node_id: str, attempt: int
    ) -> FailurePlan | None: ...


@dataclass(slots=True)
class EnginePorts:
    """The bundle of ports handed to every block execution."""

    model: ModelPort | None = None
    tool: ToolPort | None = None
    retrieval: RetrievalPort | None = None
    injector: FailureInjector | None = None
