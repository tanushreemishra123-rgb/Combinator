"""S3: capabilities, modules, workstreams and delivery packages."""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, items_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.ai.validators.scope_coverage import check_scope_coverage
from app.domain.artifacts import ArtifactKind, FunctionalScope

STAGE = "functional_scope"


def build(ctx: GenerationContext) -> StageRequest[FunctionalScope]:
    prd = ctx.artifact(ArtifactKind.PRD)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "config": config_view(ctx.config),
            "scope_items": items_view(ctx.active_items()),
            "prd_overview": prd.get("overview", ""),
            "prd_user_journeys": [
                {"name": journey.get("name"), "req_ids": journey.get("req_ids", [])}
                for journey in prd.get("user_journeys", [])
            ],
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=FunctionalScope,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level()),
            partial(check_scope_coverage, items=ctx.active_items(), level=ctx.reference_level()),
        ],
    )
