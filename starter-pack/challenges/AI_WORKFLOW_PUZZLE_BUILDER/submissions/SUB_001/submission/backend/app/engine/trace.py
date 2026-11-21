"""Trace events.

Responsibility: the run's append-only, fully reconstructable narrative. Every
executed step's input, output and status can be rebuilt from the trace alone, so
payloads are never truncated and are always JSON-serialisable.
"""

from __future__ import annotations

import asyncio
import copy
from datetime import UTC, datetime
from enum import Enum, StrEnum
from typing import Any

from pydantic import BaseModel, Field

from app.engine.model import BlockType


class StepStatus(StrEnum):
    """Lifecycle status of a single step."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    RETRYING = "retrying"
    RECOVERED = "recovered"
    SAFELY_STOPPED = "safely_stopped"
    SKIPPED = "skipped"


class EventType(StrEnum):
    """Every event the engine can append to a trace."""

    RUN_STARTED = "run_started"
    STEP_STARTED = "step_started"
    STEP_COMPLETED = "step_completed"
    STEP_FAILED = "step_failed"
    STEP_RETRYING = "step_retrying"
    STEP_REPAIRING = "step_repairing"
    STEP_RECOVERED = "step_recovered"
    STEP_SKIPPED = "step_skipped"
    VALIDATION_RESULT = "validation_result"
    REVIEW_REQUESTED = "review_requested"
    REVIEW_DECISION = "review_decision"
    FALLBACK_USED = "fallback_used"
    RUN_PAUSED = "run_paused"
    RUN_RESUMED = "run_resumed"
    RUN_COMPLETED = "run_completed"
    RUN_FAILED = "run_failed"
    RUN_SAFE_STOPPED = "run_safe_stopped"


def utcnow() -> datetime:
    """Timezone-aware ``now``; kept in one place so tests can reason about ordering."""
    return datetime.now(UTC)


def jsonable(value: Any) -> Any:
    """Return a deep, JSON-serialisable copy of ``value``.

    Pydantic models become dicts; everything else is deep-copied so later mutation
    of live run data can never rewrite history already recorded in the trace.
    """
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return copy.deepcopy(value)


class TraceEvent(BaseModel):
    """One entry in a run's trace."""

    seq: int
    run_id: str
    event: EventType
    timestamp: datetime = Field(default_factory=utcnow)
    node_id: str | None = None
    node_label: str | None = None
    node_type: BlockType | None = None
    status: StepStatus | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class TraceRecorder:
    """Appends events to a run's trace and publishes them to its live queue.

    Responsibility: own the monotonically increasing ``seq`` counter and guarantee
    that the in-memory trace and the SSE queue never diverge.
    """

    def __init__(self, run_id: str, trace: list[TraceEvent], queue: asyncio.Queue[TraceEvent] | None = None) -> None:
        self._run_id = run_id
        self._trace = trace
        self._queue = queue
        self._seq = max((event.seq for event in trace), default=0)

    @property
    def seq(self) -> int:
        return self._seq

    def emit(
        self,
        event: EventType,
        *,
        node_id: str | None = None,
        node_label: str | None = None,
        node_type: BlockType | None = None,
        status: StepStatus | None = None,
        payload: dict[str, Any] | None = None,
    ) -> TraceEvent:
        """Append one event and return it."""
        self._seq += 1
        record = TraceEvent(
            seq=self._seq,
            run_id=self._run_id,
            event=event,
            node_id=node_id,
            node_label=node_label,
            node_type=node_type,
            status=status,
            payload=jsonable(payload or {}),
        )
        self._trace.append(record)
        if self._queue is not None:
            self._queue.put_nowait(record)
        return record
