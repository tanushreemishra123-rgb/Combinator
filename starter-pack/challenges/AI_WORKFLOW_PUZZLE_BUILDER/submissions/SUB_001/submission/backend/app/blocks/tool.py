"""Tool block.

Responsibility: call one named external tool through the injected
:class:`ToolPort` and merge its result into the workflow data.
"""

from __future__ import annotations

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult, attach
from app.engine.errors import ConfigurationError, ToolFailure
from app.engine.model import BlockType


class ToolConfig(BlockConfig):
    """Which tool to call and where to store its answer."""

    tool: str = ""
    params: dict = {}
    output_field: str | None = None


class ToolBlock(Block):
    """Calls the tool port."""

    type = BlockType.TOOL
    config_model = ToolConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: ToolConfig = ctx.config  # type: ignore[assignment]
        if ctx.ports.tool is None:
            raise ConfigurationError(
                "No tool runtime is wired up for this run.", node_id=ctx.node.id
            )
        if not config.tool:
            raise ConfigurationError(
                "This Tool block has no tool selected.", node_id=ctx.node.id
            )
        try:
            value = await ctx.ports.tool.call(config.tool, dict(config.params), ctx.data)
        except Exception as exc:
            if isinstance(exc, ToolFailure):
                raise
            raise ToolFailure(
                str(exc) or exc.__class__.__name__,
                node_id=ctx.node.id,
                detail={"tool": config.tool},
            ) from exc

        return BlockResult(
            data=attach(ctx.data, config.output_field, value),
            meta={"tool": config.tool, "tool_output": value},
        )
