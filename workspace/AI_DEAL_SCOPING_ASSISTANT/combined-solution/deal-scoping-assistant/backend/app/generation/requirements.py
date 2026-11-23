"""S1a + S1b: turn customer documents into the reviewable scope model."""

from dataclasses import replace

from pydantic import ValidationError

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import extract_scope, gap_analysis
from app.ai.stages.drafts import DraftItem
from app.ai.validators.id_references import check_id_references
from app.core.errors import AIStageFailed
from app.domain.scope import ScopeItem, SourceDocument
from app.generation.common import run


def _assign(items: list[DraftItem], existing: set[str]) -> tuple[list[ScopeItem], list[Finding]]:
    try:
        return extract_scope.assign_ids(items, existing)
    except ValidationError as exc:
        raise AIStageFailed(
            "the extracted scope items are not valid",
            errors=[f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()],
        ) from exc


def analyze_requirements(
    documents: list[SourceDocument], context: GenerationContext
) -> tuple[list[ScopeItem], list[Finding]]:
    """Extract the scope (S1a), then add gaps, assumptions and questions (S1b)."""
    ctx = replace(context, documents=documents)
    document_id = extract_scope.document_id_of(ctx)
    findings: list[Finding] = []

    extraction, stage_findings = run(ctx, extract_scope.build(ctx))
    findings.extend(stage_findings)
    items, assign_findings = _assign(
        extraction.drafts(document_id), {item.id for item in ctx.items}
    )
    findings.extend(assign_findings)

    gap_ctx = replace(ctx, items=[*ctx.items, *items])
    gaps, gap_findings = run(gap_ctx, gap_analysis.build(gap_ctx))
    findings.extend(gap_findings)
    gap_items, gap_assign_findings = _assign(
        gaps.drafts(document_id), {item.id for item in gap_ctx.items}
    )
    findings.extend(gap_assign_findings)

    all_items = [*items, *gap_items]
    known = {item.id for item in ctx.items} | {item.id for item in all_items}
    findings.extend(check_id_references(all_items, known, ctx.reference_level()))
    return all_items, findings
