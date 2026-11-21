"""S1b: find missing information and raise gaps, assumptions and clarification questions.

The documents are not sent again: the extracted items carry the content, and a gap that
comes from an existing item inherits that item's verified quote here in code, so
traceability survives without paying for the text twice.
"""

from collections.abc import Sequence
from functools import partial

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, items_view, load_prompt, outline
from app.ai.stages.drafts import DraftItem, ScopeExtraction
from app.ai.validators.scope_rules import check_scope_rules
from app.ai.validators.source_refs import check_source_refs
from app.domain.scope import ScopeItem, SourceDocument

STAGE = "gap_analysis"


def build(ctx: GenerationContext) -> StageRequest[ScopeExtraction]:
    items = ctx.active_items()
    user = as_json(
        {
            "customer": ctx.customer_name,
            "opportunity_context": ctx.opportunity_context,
            "config": config_view(ctx.config),
            "document_outline": outline(ctx.documents),
            "scope_items": items_view(items),
        }
    )
    # Quotes are inherited, not written by the model; the first document carries any it does.
    document_id = ctx.documents[0].id if ctx.documents else ""
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=ScopeExtraction,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(_inherit_refs, items=items, document_id=document_id),
            partial(_check_refs, documents=ctx.documents, document_id=document_id),
            partial(_check_rules, document_id=document_id),
        ],
    )


def _linked_ids(draft: DraftItem) -> list[str]:
    question, gap = draft.details.question, draft.details.gap
    return [
        *draft.related_ids,
        *(question.affected_ids if question else []),
        *([gap.question_id, gap.assumption_id] if gap else []),
    ]


ABSENCE_NOTE = "Not mentioned in the customer input."


def note_absence(drafts: list[DraftItem]) -> None:
    """A gap or question that inherited no quote is about something the input never said.

    That absence is a fact the code can state, so the standard note is filled in instead
    of sending the answer back for repair.
    """
    for draft in drafts:
        if not draft.source_refs and not draft.absence_note.strip():
            draft.absence_note = ABSENCE_NOTE


def inherit_source_refs(drafts: list[DraftItem], items: Sequence[ScopeItem]) -> None:
    """Copy the first verified quote of a related item onto a gap or question without one.

    A gap often points at the question it raises rather than at the scope item, so a
    second pass follows that link and inherits what the pair already found.
    """
    by_id = {item.id: item for item in items}
    by_temp_id = {draft.temp_id: draft for draft in drafts}
    for _pass in range(2):
        for draft in drafts:
            if draft.source_refs:
                continue
            for ref in _linked_ids(draft):
                source = by_id.get(ref) or by_temp_id.get(ref)
                verified = (
                    next((r for r in source.source_refs if r.verified), None) if source else None
                )
                if verified is not None:
                    draft.source_refs = [verified.model_copy(deep=True)]
                    break


def _inherit_refs(
    content: ScopeExtraction, items: Sequence[ScopeItem], document_id: str
) -> list[Finding]:
    drafts = content.drafts(document_id)
    inherit_source_refs(drafts, items)
    note_absence(drafts)
    return []


def _check_refs(
    content: ScopeExtraction, documents: Sequence[SourceDocument], document_id: str
) -> list[Finding]:
    return check_source_refs(content.drafts(document_id), documents)


def _check_rules(content: ScopeExtraction, document_id: str) -> list[Finding]:
    return check_scope_rules(content.drafts(document_id))
