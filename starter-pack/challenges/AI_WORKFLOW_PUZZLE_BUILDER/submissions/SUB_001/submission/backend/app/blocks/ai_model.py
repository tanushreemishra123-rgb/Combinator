"""AI Model block.

Responsibility: hand the current data to the injected :class:`ModelPort` and merge
the provider's answer back into the workflow data. Knows nothing about which
provider is configured - that is Task 3's job behind the port.
"""

from __future__ import annotations

from typing import Any

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult, attach
from app.engine.errors import ConfigurationError, ModelFailure
from app.engine.model import BlockType


class AIModelConfig(BlockConfig):
    """How to prompt the model and where to put its answer."""

    prompt: str = ""
    system: str | None = None
    provider: str | None = None
    temperature: float | None = None
    expects_json: bool = False
    #: When set, the model's answer is written to this (dotted) field of the data.
    output_field: str | None = None


class AIModelBlock(Block):
    """Calls the model port and records confidence/provider metadata."""

    type = BlockType.AI_MODEL
    config_model = AIModelConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: AIModelConfig = ctx.config  # type: ignore[assignment]
        if ctx.ports.model is None:
            raise ConfigurationError(
                "No model provider is wired up for this run.", node_id=ctx.node.id
            )
        provider = ctx.provider_override or config.provider
        prompt_config: dict[str, Any] = dict(ctx.node.config or {})
        if ctx.repair is not None:
            # A validator rejected the previous answer: hand the model its own
            # output and the problem list so it can fix them (see RepairRequest).
            prompt_config["repair"] = ctx.repair.model_dump(mode="json")
        try:
            result = await ctx.ports.model.call(prompt_config, ctx.data, provider)
        except Exception as exc:
            if isinstance(exc, ModelFailure):
                raise
            raise ModelFailure(str(exc) or exc.__class__.__name__, node_id=ctx.node.id) from exc

        data = attach(ctx.data, config.output_field, result.data)
        return BlockResult(
            data=data,
            confidence=result.confidence,
            meta={
                "confidence": result.confidence,
                "provider_used": result.provider_used,
                "mocked": result.mocked,
                "raw": result.raw,
                "provider_requested": provider,
                **({"repair_round": ctx.repair.round} if ctx.repair is not None else {}),
            },
        )
