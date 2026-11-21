"""Input and Output blocks.

Responsibility: mark the two ends of a workflow. Both are pass-through; the
executor injects the run's sample input at the Input block and captures the final
result at the Output block.
"""

from __future__ import annotations

from typing import Any

from app.blocks.base import MISSING, Block, BlockConfig, BlockContext, BlockResult, get_path
from app.engine.model import BlockType


class InputConfig(BlockConfig):
    """Optional static defaults merged under the run's sample input."""

    defaults: dict[str, Any] | None = None


class InputBlock(Block):
    """Injects the run's sample input into the workflow."""

    type = BlockType.INPUT
    config_model = InputConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: InputConfig = ctx.config  # type: ignore[assignment]
        data = ctx.data
        if config.defaults and isinstance(data, dict):
            data = {**config.defaults, **data}
        elif config.defaults and data is None:
            data = dict(config.defaults)
        return BlockResult(data=data)


class OutputConfig(BlockConfig):
    """Optionally narrow the final result to one field."""

    field: str | None = None


class OutputBlock(Block):
    """Captures the final result of the run."""

    type = BlockType.OUTPUT
    config_model = OutputConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: OutputConfig = ctx.config  # type: ignore[assignment]
        data = ctx.data
        if config.field:
            value = get_path(data, config.field, MISSING)
            data = None if value is MISSING else value
        return BlockResult(data=data)
