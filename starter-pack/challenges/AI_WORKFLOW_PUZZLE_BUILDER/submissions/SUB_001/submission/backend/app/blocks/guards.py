"""Guard blocks: Retry, Timeout and Fallback.

Responsibility: *declare* a reliability policy for the next non-guard block in the
chain. Guards never execute work themselves - the executor folds consecutive
guards into a single policy, applies it to the block they protect, and records
each guard in the trace as its own step describing what it did.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult
from app.engine.errors import ConfigurationError
from app.engine.model import BlockType


class RetryConfig(BlockConfig):
    """How many times, and how fast, to re-attempt the protected block."""

    max_attempts: int = Field(default=2, ge=1, le=10)
    delay_ms: int = Field(default=0, ge=0)


class TimeoutConfig(BlockConfig):
    """How long a single attempt of the protected block may take."""

    timeout_ms: int = Field(default=5000, ge=1)


class FallbackConfig(BlockConfig):
    """What to do once the protected block has exhausted its attempts."""

    mode: Literal["safe_default", "alternate_provider"] = "safe_default"
    safe_default: Any = None
    provider: str | None = None


class _GuardBlock(Block):
    """Guards are folded into a policy; executing one directly is a bug."""

    async def execute(self, ctx: BlockContext) -> BlockResult:  # pragma: no cover
        raise ConfigurationError(
            f"{ctx.node.display_label} is a guard and must sit before the block it "
            "protects.",
            node_id=ctx.node.id,
        )


class RetryBlock(_GuardBlock):
    """Re-attempts the protected block up to ``max_attempts`` times."""

    type = BlockType.RETRY
    config_model = RetryConfig


class TimeoutBlock(_GuardBlock):
    """Caps how long one attempt of the protected block may run."""

    type = BlockType.TIMEOUT
    config_model = TimeoutConfig


class FallbackBlock(_GuardBlock):
    """Recovers the protected block after its last failed attempt."""

    type = BlockType.FALLBACK
    config_model = FallbackConfig
