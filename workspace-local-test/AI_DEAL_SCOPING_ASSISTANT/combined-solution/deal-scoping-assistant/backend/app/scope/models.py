"""Models the scope API needs on top of the domain read models."""

from pydantic import Field

from app.domain.base import DomainModel
from app.domain.scope import ItemType, ScopeItem, ScopeItemBase, ScopeStatus


class ScopeGroup(DomainModel):
    type: ItemType = Field(description="Scope category of the items in this group.")
    items: list[ScopeItem] = Field(description="Items of that category, in id order.")


class ScopeView(DomainModel):
    """`GET /sessions/{id}/scope`: the whole scope grouped by type, plus its review state."""

    session_id: str = Field(description="Session the scope belongs to.")
    scope_version: int = Field(description="Current scope version; 0 before the first approval.")
    scope_status: ScopeStatus = Field(description="empty, analyzed or approved.")
    locked: bool = Field(
        description="True once approved: further edits must go through the change service."
    )
    groups: list[ScopeGroup] = Field(description="Non-empty groups, in the order of the 15 types.")


class ItemChange(DomainModel):
    """Before/after of one mutation, so the change service can build a ChangeRecord."""

    before: ScopeItem | None = Field(default=None, description="Item state before the mutation.")
    after: ScopeItem | None = Field(default=None, description="Item state after the mutation.")


class AnalyzedItem(ScopeItemBase):
    """An item produced by the analysis stage; it may propose its own id."""

    id: str = Field(default="", description="Id proposed by the AI stage; assigned when empty.")


class QuestionAnswer(DomainModel):
    answer: str = Field(min_length=1, description="Answer recorded by the reviewer.")
