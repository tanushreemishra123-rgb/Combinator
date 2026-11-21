"""Human Review block.

Responsibility: describe the decision a person is being asked to make. Executing
it produces a :class:`ReviewRequest` and a ``PAUSE`` control signal; persisting
the run and waiting for the decision is the executor's job.
"""

from __future__ import annotations

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult, Control
from app.engine.model import BlockType
from app.engine.run import ReviewRequest

DEFAULT_ACTIONS = ["approve", "edit", "reject"]


class HumanReviewConfig(BlockConfig):
    """What the reviewer is shown and which actions they may take."""

    prompt: str = "Review this before the workflow continues."
    allowed_actions: list[str] = DEFAULT_ACTIONS


class HumanReviewBlock(Block):
    """Pauses the run and asks a person to approve, edit or reject."""

    type = BlockType.HUMAN_REVIEW
    config_model = HumanReviewConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: HumanReviewConfig = ctx.config  # type: ignore[assignment]
        review = ReviewRequest(
            node_id=ctx.node.id,
            node_label=ctx.node.display_label,
            prompt=config.prompt,
            data=ctx.data,
            allowed_actions=list(config.allowed_actions or DEFAULT_ACTIONS),
        )
        return BlockResult(
            data=ctx.data,
            control=Control.PAUSE,
            review=review,
            meta={"prompt": config.prompt, "allowed_actions": review.allowed_actions},
        )
