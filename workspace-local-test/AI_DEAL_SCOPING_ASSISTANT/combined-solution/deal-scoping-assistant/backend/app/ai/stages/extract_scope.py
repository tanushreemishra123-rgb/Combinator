"""S1a: extract the structured scope model from the customer documents.

The model proposes items with temporary keys; ids such as FR_01 are assigned here, in
code, so they stay deterministic and unique per session.
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from functools import partial

from app.ai.context import GenerationContext
from app.ai.findings import Finding, warning
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, documents_view, load_prompt
from app.ai.stages.drafts import DraftItem, ScopeExtraction
from app.ai.validators.scope_rules import check_scope_rules
from app.ai.validators.source_refs import check_source_refs
from app.core.ids import next_id
from app.domain.scope import ScopeItem, SourceDocument

STAGE = "extract_scope"


def document_id_of(ctx: GenerationContext) -> str:
    """Quotes carry a segment id; the document is the session's first one."""
    return ctx.documents[0].id if ctx.documents else ""


def build(ctx: GenerationContext) -> StageRequest[ScopeExtraction]:
    user = as_json(
        {
            "customer": ctx.customer_name,
            "opportunity_context": ctx.opportunity_context,
            "config": config_view(ctx.config),
            "documents": documents_view(ctx.documents),
        }
    )
    document_id = document_id_of(ctx)
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=ScopeExtraction,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_refs, documents=ctx.documents, document_id=document_id),
            partial(check_rules, document_id=document_id),
        ],
    )


def check_refs(
    content: ScopeExtraction, documents: Sequence[SourceDocument], document_id: str
) -> list[Finding]:
    return check_source_refs(content.drafts(document_id), documents)


def check_rules(content: ScopeExtraction, document_id: str) -> list[Finding]:
    return check_scope_rules(content.drafts(document_id))


def _mapped(ref: str, mapping: dict[str, str], known_ids: set[str]) -> str:
    """Temp id -> assigned id; ids that already exist in the scope are kept."""
    if ref in mapping:
        return mapping[ref]
    return ref if ref in known_ids else ""


def link_gaps(items: list[DraftItem]) -> None:
    """Make the gap -> question/assumption links explicit on both items.

    The model records them in `details.gap`; the scope model keeps traceability in
    `related_ids`, so both directions are filled in before the items are built.
    """
    by_key = {item.temp_id: item for item in items}
    for item in items:
        gap = item.details.gap
        if gap is None:
            continue
        for target in (gap.question_id, gap.assumption_id):
            if not target:
                continue
            if target not in item.related_ids:
                item.related_ids.append(target)
            other = by_key.get(target)
            if other is not None and item.temp_id not in other.related_ids:
                other.related_ids.append(item.temp_id)


def assign_ids(
    items: list[DraftItem], existing_ids: set[str]
) -> tuple[list[ScopeItem], list[Finding]]:
    """Assign ids per type prefix and rewrite every cross reference to the new ids."""
    link_gaps(items)
    taken = set(existing_ids)
    mapping: dict[str, str] = {}
    for item in items:
        assigned = next_id(item.type.value, taken)
        taken.add(assigned)
        mapping[item.temp_id] = assigned

    findings: list[Finding] = []
    now = datetime.now(UTC)
    scope_items: list[ScopeItem] = []
    for item in items:
        item_id = mapping[item.temp_id]

        def rewrite(refs: list[str], item_id: str = item_id) -> list[str]:
            kept: list[str] = []
            for ref in refs:
                target = _mapped(ref, mapping, existing_ids)
                if target:
                    kept.append(target)
                else:
                    findings.append(
                        warning(f"{item_id}: dropped reference to unknown item '{ref}'", [item_id])
                    )
            return kept

        details = item.details.model_copy(deep=True)
        if details.gap is not None:
            details.gap.question_id = _mapped(details.gap.question_id, mapping, existing_ids)
            details.gap.assumption_id = _mapped(details.gap.assumption_id, mapping, existing_ids)
        if details.question is not None:
            details.question.affected_ids = rewrite(details.question.affected_ids)

        scope_items.append(
            ScopeItem(
                id=item_id,
                type=item.type,
                title=item.title,
                description=item.description,
                priority=item.priority,
                origin=item.origin,
                source_refs=item.source_refs,
                related_ids=rewrite(item.related_ids),
                tags=item.tags,
                absence_note=item.absence_note,
                details=details,
                created_at=now,
                updated_at=now,
            )
        )
    return scope_items, findings
