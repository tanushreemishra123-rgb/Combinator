"""Block execution contract.

Responsibility: define what a block *is* - a typed config model plus one async
``execute`` - and the small context/result objects the executor passes around.
Blocks never touch run state, the trace, retries or routing; they do one unit of
work and describe the outcome.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict

from app.engine.model import BlockType, NodeDef
from app.engine.ports import EnginePorts
from app.engine.run import RepairRequest, ReviewRequest, ValidationResult

MISSING = object()
"""Sentinel for "no value at this path", distinct from a stored ``None``."""


class BlockConfig(BaseModel):
    """Base config model; unknown keys are kept so the UI can store view state."""

    model_config = ConfigDict(extra="allow")


class Control(StrEnum):
    """What the executor should do after a block returns."""

    CONTINUE = "continue"
    PAUSE = "pause"
    SAFE_STOP = "safe_stop"


@dataclass(slots=True)
class BlockContext:
    """Everything a block is allowed to see while executing."""

    node: NodeDef
    config: BlockConfig
    data: Any
    run_id: str
    attempt: int
    ports: EnginePorts
    provider_override: str | None = None
    scenario_id: str | None = None
    #: Confidence reported by the most recent model call, if any.
    confidence: float | None = None
    #: Set when a validator is sending this step's rejected answer back for repair.
    repair: RepairRequest | None = None


@dataclass(slots=True)
class BlockResult:
    """The outcome of one block execution."""

    data: Any
    handle: str | None = None
    control: Control = Control.CONTINUE
    validation: ValidationResult | None = None
    review: ReviewRequest | None = None
    message: str | None = None
    confidence: float | None = None
    #: Extra, JSON-serialisable detail merged into the step's trace payload.
    meta: dict[str, Any] = field(default_factory=dict)


class Block(ABC):
    """A stateless executor for one block type."""

    type: ClassVar[BlockType]
    config_model: ClassVar[type[BlockConfig]] = BlockConfig

    def parse_config(self, node: NodeDef) -> BlockConfig:
        """Validate ``node.config``; raises ``pydantic.ValidationError`` if invalid."""
        return self.config_model.model_validate(node.config or {})

    @abstractmethod
    async def execute(self, ctx: BlockContext) -> BlockResult:
        """Do the block's unit of work."""
        raise NotImplementedError


def get_path(data: Any, path: str, default: Any = MISSING) -> Any:
    """Read a dotted ``path`` out of nested mappings/sequences."""
    current = data
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return default
    return current


def set_path(data: Any, path: str, value: Any) -> Any:
    """Return a copy of ``data`` with dotted ``path`` set to ``value``."""
    parts = path.split(".")
    if not isinstance(data, dict):
        data = {}
    root = dict(data)
    cursor = root
    for part in parts[:-1]:
        nested = cursor.get(part)
        cursor[part] = dict(nested) if isinstance(nested, dict) else {}
        cursor = cursor[part]
    cursor[parts[-1]] = value
    return root


def drop_path(data: Any, path: str) -> Any:
    """Return a copy of ``data`` with dotted ``path`` removed (used by failure injection)."""
    parts = path.split(".")
    if not isinstance(data, dict):
        return data
    root = dict(data)
    cursor = root
    for part in parts[:-1]:
        nested = cursor.get(part)
        if not isinstance(nested, dict):
            return root
        cursor[part] = dict(nested)
        cursor = cursor[part]
    cursor.pop(parts[-1], None)
    return root


def attach(data: Any, field_name: str | None, value: Any) -> Any:
    """Merge ``value`` into ``data`` under ``field_name``, or replace ``data``."""
    if field_name:
        return set_path(data, field_name, value)
    return value
