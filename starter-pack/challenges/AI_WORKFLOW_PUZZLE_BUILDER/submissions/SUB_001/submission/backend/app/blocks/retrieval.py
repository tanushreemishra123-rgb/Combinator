"""Retrieval block.

Responsibility: fetch grounding documents through the injected
:class:`RetrievalPort` and expose how many came back so downstream conditions can
refuse to answer on an empty result.
"""

from __future__ import annotations

from app.blocks.base import Block, BlockConfig, BlockContext, BlockResult, set_path
from app.engine.errors import ConfigurationError, RetrievalFailure
from app.engine.model import BlockType


class RetrievalConfig(BlockConfig):
    """What to search for and where to put the documents."""

    query: str | None = None
    source: str | None = None
    top_k: int = 3
    output_field: str = "documents"
    count_field: str | None = "document_count"


class RetrievalBlock(Block):
    """Calls the retrieval port and records the document count."""

    type = BlockType.RETRIEVAL
    config_model = RetrievalConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: RetrievalConfig = ctx.config  # type: ignore[assignment]
        if ctx.ports.retrieval is None:
            raise ConfigurationError(
                "No retrieval source is wired up for this run.", node_id=ctx.node.id
            )
        try:
            documents = await ctx.ports.retrieval.retrieve(
                dict(ctx.node.config or {}), ctx.data
            )
        except Exception as exc:
            if isinstance(exc, RetrievalFailure):
                raise
            raise RetrievalFailure(
                str(exc) or exc.__class__.__name__, node_id=ctx.node.id
            ) from exc

        documents = list(documents or [])
        data = set_path(ctx.data, config.output_field, documents)
        if config.count_field:
            data = set_path(data, config.count_field, len(documents))
        return BlockResult(
            data=data,
            meta={"document_count": len(documents), "documents": documents},
        )
