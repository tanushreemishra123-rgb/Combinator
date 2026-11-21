"""S8: the AI solution approach, with framework recommendations from the catalog."""

from functools import partial
from typing import Any

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, items_view, load_prompt, shorten
from app.ai.validators.ai_completeness import check_ai_completeness
from app.ai.validators.id_references import check_id_references
from app.catalogs.cloud_services import load_cloud_catalog
from app.catalogs.frameworks import load_frameworks
from app.domain.artifacts import AiStrategy, ArchitectureArea, ArtifactKind

STAGE = "ai_strategy"


def frameworks_view() -> list[dict[str, Any]]:
    """Short catalog entries: the model needs the name, the ecosystem and the fit."""
    return [
        {
            "name": framework.name,
            "language_ecosystems": framework.language_ecosystems,
            "best_for": framework.best_for[:2],
            "avoid_when": framework.avoid_when[:1],
            "notes": shorten(framework.notes, 140),
        }
        for framework in load_frameworks().frameworks
    ]


def build(ctx: GenerationContext) -> StageRequest[AiStrategy]:
    architecture = ctx.artifact(ArtifactKind.ARCHITECTURE)
    functional_scope = ctx.artifact(ArtifactKind.FUNCTIONAL_SCOPE)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "opportunity_context": ctx.opportunity_context,
            "config": config_view(ctx.config),
            "platform": ctx.platform.value if ctx.platform else "",
            "scope_items": items_view(ctx.active_items()),
            "capabilities": elements_view(
                functional_scope.get("capabilities", []), ("id", "name", "included_req_ids")
            ),
            "architecture_components": elements_view(
                architecture.get("components", []), ("id", "name", "area")
            ),
            "frameworks": frameworks_view(),
            "catalog_ai_services": _ai_services(ctx),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=AiStrategy,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level()),
            partial(check_ai_completeness, level=ctx.reference_level()),
        ],
    )


def _ai_services(ctx: GenerationContext) -> list[str]:
    """The selected platform's AI services, so provider options name real services."""
    if ctx.platform is None:
        return []
    catalog = load_cloud_catalog(ctx.platform)
    return [s.name for s in catalog.services_for_area(ArchitectureArea.AI_AND_ML_SERVICES)]
