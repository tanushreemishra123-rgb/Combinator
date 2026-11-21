"""Safe Stop block.

Responsibility: end a run deliberately and explain, in plain language, why the
workflow chose to stop rather than produce an unreliable answer.
"""

from __future__ import annotations

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult, Control
from app.engine.model import BlockType

DEFAULT_MESSAGE = (
    "The workflow stopped safely instead of continuing with an unreliable result."
)


class SafeStopConfig(BlockConfig):
    """The explanation shown to the user when this stop is reached."""

    message: str = DEFAULT_MESSAGE
    reason: str | None = None


class SafeStopBlock(Block):
    """Terminates the run with a friendly explanation."""

    type = BlockType.SAFE_STOP
    config_model = SafeStopConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: SafeStopConfig = ctx.config  # type: ignore[assignment]
        message = config.message or DEFAULT_MESSAGE
        return BlockResult(
            data=ctx.data,
            control=Control.SAFE_STOP,
            message=message,
            meta={"explanation": message, "reason": config.reason},
        )
