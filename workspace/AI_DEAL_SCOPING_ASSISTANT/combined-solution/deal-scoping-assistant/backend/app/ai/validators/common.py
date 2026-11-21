"""Shared helpers for validators that walk scope items."""

from typing import Any, Protocol

from app.domain.scope import ItemType, ScopeItemDetails, SourceRef


class TraceableItem(Protocol):
    """Both the extraction draft and the stored ScopeItem expose these fields."""

    type: ItemType
    source_refs: list[SourceRef]
    related_ids: list[str]
    details: ScopeItemDetails


def item_key(item: Any) -> str:
    """Identity of an item: its scope id once assigned, otherwise the model's temp id."""
    key = getattr(item, "id", "") or getattr(item, "temp_id", "")
    return str(key)
