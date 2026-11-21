"""Condition block.

Responsibility: evaluate one comparison against the current data and tell the
executor which branch handle (``"true"`` / ``"false"``) to follow.
"""

from __future__ import annotations

from typing import Any, Literal

from app.blocks.base import MISSING, Block, BlockConfig, BlockContext, BlockResult, get_path
from app.engine.model import FALSE_HANDLE, TRUE_HANDLE, BlockType

Operator = Literal["eq", "ne", "gt", "lt", "gte", "lte", "exists", "not_empty"]


class ConditionConfig(BlockConfig):
    """The comparison to run against the current data."""

    field: str = ""
    operator: Operator = "exists"
    value: Any = None


def _is_empty(value: Any) -> bool:
    if value is MISSING or value is None:
        return True
    if isinstance(value, (str, list, tuple, dict, set)):
        return len(value) == 0
    return False


def _compare(operator: str, actual: Any, expected: Any) -> bool:
    """Evaluate one operator, returning ``False`` for incomparable operands."""
    if operator == "exists":
        return actual is not MISSING and actual is not None
    if operator == "not_empty":
        return not _is_empty(actual)
    if actual is MISSING:
        return operator == "ne"
    if operator == "eq":
        return bool(actual == expected)
    if operator == "ne":
        return bool(actual != expected)
    try:
        if operator == "gt":
            return actual > expected
        if operator == "lt":
            return actual < expected
        if operator == "gte":
            return actual >= expected
        if operator == "lte":
            return actual <= expected
    except TypeError:
        return False
    return False


class ConditionBlock(Block):
    """Routes the run down the true or false branch."""

    type = BlockType.CONDITION
    config_model = ConditionConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: ConditionConfig = ctx.config  # type: ignore[assignment]
        actual = get_path(ctx.data, config.field, MISSING) if config.field else ctx.data
        matched = _compare(config.operator, actual, config.value)
        return BlockResult(
            data=ctx.data,
            handle=TRUE_HANDLE if matched else FALSE_HANDLE,
            meta={
                "field": config.field,
                "operator": config.operator,
                "expected": config.value,
                "actual": None if actual is MISSING else actual,
                "field_present": actual is not MISSING,
                "matched": matched,
                "branch": TRUE_HANDLE if matched else FALSE_HANDLE,
            },
        )
