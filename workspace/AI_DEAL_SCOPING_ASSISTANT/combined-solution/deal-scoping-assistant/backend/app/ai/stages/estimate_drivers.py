"""S9: what drives the effort. The model never produces effort, cost or dates."""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import ArtifactKind, EstimateDrivers

STAGE = "estimate_drivers"


def build(ctx: GenerationContext) -> StageRequest[EstimateDrivers]:
    functional_scope = ctx.artifact(ArtifactKind.FUNCTIONAL_SCOPE)
    architecture = ctx.artifact(ArtifactKind.ARCHITECTURE)
    integrations = ctx.artifact(ArtifactKind.INTEGRATION_ARCHITECTURE)
    ai_strategy = ctx.artifact(ArtifactKind.AI_STRATEGY)
    data_strategy = ctx.artifact(ArtifactKind.DATA_STRATEGY)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "config": config_view(ctx.config),
            # No scope items: every unit below already carries the requirement ids it covers.
            "capabilities": elements_view(
                functional_scope.get("capabilities", []),
                ("id", "name", "included_req_ids", "priority", "workstream_id"),
            ),
            "workstreams": elements_view(
                functional_scope.get("workstreams", []), ("id", "name", "capability_ids")
            ),
            "integrations": elements_view(
                integrations.get("integrations", []), ("id", "name", "pattern", "req_ids")
            ),
            "ai_use_cases": elements_view(
                ai_strategy.get("use_cases", []),
                ("id", "name", "processing_class", "req_ids"),
            ),
            "architecture_components": elements_view(
                architecture.get("components", []), ("id", "name", "area")
            ),
            "data_domains": elements_view(
                data_strategy.get("domains", []), ("id", "name", "req_ids")
            ),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=EstimateDrivers,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level())
        ],
    )
