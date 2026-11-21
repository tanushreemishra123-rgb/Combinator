"""Transform block.

Responsibility: small, deterministic reshaping of the workflow data - rename,
pick, merge or fill a template. Deliberately minimal: no expressions, no code.
"""

from __future__ import annotations

from typing import Any, Literal

from app.blocks.base import (
    MISSING,
    Block,
    BlockConfig,
    BlockContext,
    BlockResult,
    get_path,
    set_path,
)
from app.engine.errors import ConfigurationError
from app.engine.model import BlockType

Operation = Literal["rename", "pick", "merge", "template"]


class TransformConfig(BlockConfig):
    """Which reshaping to apply."""

    operation: Operation = "merge"
    #: rename: ``{"old": "new"}``
    mapping: dict[str, str] = {}
    #: pick: the (dotted) fields to keep
    fields: list[str] = []
    #: merge: static values merged over the data
    values: dict[str, Any] = {}
    #: template: a ``str.format``-style string plus the field to write it to
    template: str = ""
    target: str = "text"


class TransformBlock(Block):
    """Applies one deterministic reshaping operation."""

    type = BlockType.TRANSFORM
    config_model = TransformConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: TransformConfig = ctx.config  # type: ignore[assignment]
        data = ctx.data
        operation = config.operation

        if operation == "rename":
            if not isinstance(data, dict):
                raise ConfigurationError(
                    "Rename needs object data to work on.", node_id=ctx.node.id
                )
            result: dict[str, Any] = dict(data)
            for old, new in config.mapping.items():
                if old in result:
                    result[new] = result.pop(old)
            data = result
        elif operation == "pick":
            picked: dict[str, Any] = {}
            for field_name in config.fields:
                value = get_path(data, field_name, MISSING)
                if value is not MISSING:
                    picked = set_path(picked, field_name, value)
            data = picked
        elif operation == "merge":
            data = {**data, **config.values} if isinstance(data, dict) else config.values
        elif operation == "template":
            rendered = _render(config.template, data)
            data = set_path(data, config.target, rendered)
        else:  # pragma: no cover - guarded by the Literal type
            raise ConfigurationError(
                f"Unknown transform operation {operation!r}.", node_id=ctx.node.id
            )

        return BlockResult(data=data, meta={"operation": operation})


def _render(template: str, data: Any) -> str:
    """Fill ``{field}`` placeholders from ``data``; unknown fields become empty."""
    if not isinstance(data, dict):
        return template
    return template.format_map(_Blanks(data))


class _Blanks(dict):
    def __missing__(self, key: str) -> str:
        return ""
