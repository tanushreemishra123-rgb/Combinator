"""S2: the Product Requirements Document.

Traceability is computed from the finished document, not written by the model, so it can
never disagree with the sections.
"""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, items_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import Prd, TraceabilityEntry

STAGE = "prd"

_SECTION_FIELDS = (
    "objectives",
    "personas",
    "user_journeys",
    "out_of_scope",
    "functional_requirements",
    "non_functional_requirements",
    "integrations",
    "dependencies",
    "assumptions",
    "risks",
    "open_questions",
)


def build(ctx: GenerationContext) -> StageRequest[Prd]:
    user = as_json(
        {
            "customer": ctx.customer_name,
            "opportunity_context": ctx.opportunity_context,
            "config": config_view(ctx.config),
            "scope_items": items_view(ctx.active_items()),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=Prd,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level())
        ],
    )


def traceability(prd: Prd) -> list[TraceabilityEntry]:
    """Where each requirement id appears in the document."""
    sections: dict[str, list[str]] = {}
    for name in _SECTION_FIELDS:
        for element in getattr(prd, name):
            for req_id in element.req_ids:
                sections.setdefault(req_id, [])
                if name not in sections[req_id]:
                    sections[req_id].append(name)
    return [
        TraceabilityEntry(req_id=req_id, sections=sections[req_id]) for req_id in sorted(sections)
    ]


def with_traceability(prd: Prd) -> Prd:
    prd.traceability = traceability(prd)
    return prd
