"""Workflow block implementations and the type -> block registry.

Every block is stateless, so one shared instance per type is enough.
"""

from __future__ import annotations

from app.blocks.ai_model import AIModelBlock, AIModelConfig
from app.blocks.base import (
    Block,
    BlockConfig,
    BlockContext,
    BlockResult,
    Control,
    attach,
    drop_path,
    get_path,
    set_path,
)
from app.blocks.condition import ConditionBlock, ConditionConfig
from app.blocks.guards import (
    FallbackBlock,
    FallbackConfig,
    RetryBlock,
    RetryConfig,
    TimeoutBlock,
    TimeoutConfig,
)
from app.blocks.human_review import HumanReviewBlock, HumanReviewConfig
from app.blocks.io import InputBlock, InputConfig, OutputBlock, OutputConfig
from app.blocks.retrieval import RetrievalBlock, RetrievalConfig
from app.blocks.safe_stop import SafeStopBlock, SafeStopConfig
from app.blocks.tool import ToolBlock, ToolConfig
from app.blocks.transform import TransformBlock, TransformConfig
from app.blocks.validator import ValidatorBlock, ValidatorConfig
from app.engine.model import BlockType

_REGISTRY: dict[BlockType, Block] = {
    block.type: block
    for block in (
        InputBlock(),
        AIModelBlock(),
        ToolBlock(),
        RetrievalBlock(),
        ConditionBlock(),
        TransformBlock(),
        ValidatorBlock(),
        HumanReviewBlock(),
        SafeStopBlock(),
        OutputBlock(),
        RetryBlock(),
        TimeoutBlock(),
        FallbackBlock(),
    )
}


def get_block(block_type: BlockType | str) -> Block:
    """Return the block implementation for ``block_type``.

    Raises ``KeyError`` for unknown types so callers can report it as a graph error.
    """
    if not isinstance(block_type, BlockType):
        block_type = BlockType(block_type)
    return _REGISTRY[block_type]


def registered_types() -> list[BlockType]:
    """Every block type the engine can execute."""
    return list(_REGISTRY)


__all__ = [
    "AIModelBlock",
    "AIModelConfig",
    "Block",
    "BlockConfig",
    "BlockContext",
    "BlockResult",
    "ConditionBlock",
    "ConditionConfig",
    "Control",
    "FallbackBlock",
    "FallbackConfig",
    "HumanReviewBlock",
    "HumanReviewConfig",
    "InputBlock",
    "InputConfig",
    "OutputBlock",
    "OutputConfig",
    "RetrievalBlock",
    "RetrievalConfig",
    "RetryBlock",
    "RetryConfig",
    "SafeStopBlock",
    "SafeStopConfig",
    "TimeoutBlock",
    "TimeoutConfig",
    "ToolBlock",
    "ToolConfig",
    "TransformBlock",
    "TransformConfig",
    "ValidatorBlock",
    "ValidatorConfig",
    "attach",
    "drop_path",
    "get_block",
    "get_path",
    "registered_types",
    "set_path",
]
