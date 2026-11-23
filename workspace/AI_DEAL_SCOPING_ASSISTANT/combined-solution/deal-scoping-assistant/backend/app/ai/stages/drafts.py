"""The shapes used between the model and the scope model.

`ExtractedItem` is what the model fills in: flat fields only, no nested optional blocks
and no offsets, because every field costs output tokens in a per-minute budget.
`DraftItem` is the internal shape the validators and the id assignment work on; it
mirrors a `ScopeItem` before its id exists.
"""

from pydantic import Field, PrivateAttr

from app.domain.base import DomainModel
from app.domain.scope import (
    AssumptionDetails,
    GapCriticality,
    GapDetails,
    IntegrationDetails,
    IntegrationDirection,
    IntegrationPattern,
    ItemType,
    NfrCategory,
    NfrDetails,
    Origin,
    Priority,
    QuestionDetails,
    ScopeItemDetails,
    SourceRef,
)


class ExtractedRef(DomainModel):
    """A quote from a document segment; the document id is added in code."""

    segment_id: str = Field(description="Segment the quote comes from, for example D1.S12.")
    quote: str = Field(description="Customer text copied character for character.")


class ExtractedItem(DomainModel):
    """A scope item as the model proposes it. Fill only the fields your stage asks for."""

    temp_id: str = Field(description="Temporary key of this item, for example t1.")
    type: ItemType = Field(description="Scope category.")
    title: str = Field(description="Short title.")
    description: str = Field(default="", description="One sentence stating the item.")
    priority: Priority = Field(default=Priority.MEDIUM, description="Review priority.")
    origin: Origin = Field(description="customer_stated, ai_inferred or assumed.")
    quotes: list[ExtractedRef] = Field(
        default_factory=list, description="Exact quotes this item comes from."
    )
    related_ids: list[str] = Field(
        default_factory=list, description="Temp ids of this answer or existing scope ids."
    )
    tags: list[str] = Field(default_factory=list, description="Tags used by later stages.")
    absence_note: str = Field(default="", description="Why there is no quote, for GAP and Q items.")
    nfr_category: NfrCategory | None = Field(default=None, description="NFR items only.")
    integration_system: str = Field(default="", description="INT items only: the other system.")
    integration_direction: IntegrationDirection | None = Field(
        default=None, description="INT items only."
    )
    integration_pattern: IntegrationPattern | None = Field(
        default=None, description="INT items only."
    )
    gap_criticality: GapCriticality | None = Field(default=None, description="GAP items only.")
    question_id: str = Field(default="", description="GAP items only: the question raised.")
    assumption_id: str = Field(default="", description="GAP items only: the assumption made.")
    why_it_matters: str = Field(default="", description="Q items only: why the answer changes it.")
    affected_ids: list[str] = Field(
        default_factory=list, description="Q items only: scope ids the answer changes."
    )
    impact_if_wrong: str = Field(default="", description="ASM items only: what breaks if wrong.")


class ScopeExtraction(DomainModel):
    items: list[ExtractedItem] = Field(default_factory=list, description="Extracted scope items.")

    # The expansion is cached: the validators fill in offsets on it and the same objects
    # then become the scope items.
    _drafts: list["DraftItem"] | None = PrivateAttr(default=None)

    def drafts(self, document_id: str) -> list["DraftItem"]:
        if self._drafts is None:
            self._drafts = [to_draft(item, document_id) for item in self.items]
        return self._drafts


class DraftItem(DomainModel):
    """A scope item with its final shape but no id yet; validators run on this."""

    temp_id: str = Field(description="Temporary key of this item.")
    type: ItemType = Field(description="Scope category.")
    title: str = Field(description="Short title.")
    description: str = Field(default="", description="Full statement of the item.")
    priority: Priority = Field(default=Priority.MEDIUM, description="Review priority.")
    origin: Origin = Field(description="customer_stated, ai_inferred or assumed.")
    source_refs: list[SourceRef] = Field(
        default_factory=list, description="References to the originating customer text."
    )
    related_ids: list[str] = Field(default_factory=list, description="Related item keys.")
    tags: list[str] = Field(default_factory=list, description="Tags used by later stages.")
    absence_note: str = Field(default="", description="Why there is no source reference.")
    details: ScopeItemDetails = Field(
        default_factory=ScopeItemDetails, description="Type-specific fields."
    )


def _details(item: ExtractedItem) -> ScopeItemDetails:
    """Build the type block the scope model expects; missing input stays None so it is flagged."""
    details = ScopeItemDetails()
    if item.type is ItemType.NON_FUNCTIONAL_REQUIREMENT and item.nfr_category is not None:
        details.nfr = NfrDetails(category=item.nfr_category)
    if (
        item.type is ItemType.INTEGRATION
        and item.integration_direction
        and item.integration_pattern
    ):
        details.integration = IntegrationDetails(
            system=item.integration_system,
            direction=item.integration_direction,
            pattern=item.integration_pattern,
        )
    if item.type is ItemType.MISSING_INFORMATION and item.gap_criticality is not None:
        details.gap = GapDetails(
            criticality=item.gap_criticality,
            question_id=item.question_id,
            assumption_id=item.assumption_id,
        )
    if item.type is ItemType.ASSUMPTION:
        details.assumption = AssumptionDetails(impact_if_wrong=item.impact_if_wrong)
    if item.type is ItemType.CLARIFICATION_QUESTION:
        details.question = QuestionDetails(
            why_it_matters=item.why_it_matters, affected_ids=list(item.affected_ids)
        )
    return details


def document_of(segment_id: str, fallback: str) -> str:
    """Segment ids carry their document (`D2.S5` belongs to `D2`), so a second document
    keeps its own references; the fallback covers a malformed segment id."""
    head, _, rest = segment_id.partition(".")
    return head if rest else fallback


def to_draft(item: ExtractedItem, document_id: str) -> DraftItem:
    """Expand one model answer into the shape the validators and the scope model use."""
    return DraftItem(
        temp_id=item.temp_id,
        type=item.type,
        title=item.title,
        description=item.description,
        priority=item.priority,
        origin=item.origin,
        source_refs=[
            SourceRef(
                document_id=document_of(ref.segment_id, document_id),
                segment_id=ref.segment_id,
                quote=ref.quote,
            )
            for ref in item.quotes
        ],
        related_ids=list(item.related_ids),
        tags=list(item.tags),
        absence_note=item.absence_note,
        details=_details(item),
    )
