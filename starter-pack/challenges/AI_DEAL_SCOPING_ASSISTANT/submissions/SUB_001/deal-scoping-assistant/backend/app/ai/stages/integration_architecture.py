"""S7: the integration architecture. Platform neutral, like the data strategy."""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, items_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import ArtifactKind, IntegrationArchitecture
from app.domain.scope import ItemType

STAGE = "integration_architecture"

_RELEVANT = (
    ItemType.INTEGRATION,
    ItemType.EXISTING_SYSTEM,
    ItemType.DATA_REQUIREMENT,
    ItemType.SECURITY_COMPLIANCE,
    ItemType.NON_FUNCTIONAL_REQUIREMENT,
    ItemType.DEPENDENCY,
    ItemType.ASSUMPTION,
)


def build(ctx: GenerationContext) -> StageRequest[IntegrationArchitecture]:
    architecture = ctx.artifact(ArtifactKind.ARCHITECTURE)
    functional_scope = ctx.artifact(ArtifactKind.FUNCTIONAL_SCOPE)
    user = as_json(
        {
            "customer": ctx.customer_name,
            "config": config_view(ctx.config),
            "scope_items": items_view(ctx.items_of(*_RELEVANT)),
            "architecture_components": elements_view(
                architecture.get("components", []), ("id", "name", "area", "purpose")
            ),
            "capabilities": elements_view(
                functional_scope.get("capabilities", []), ("id", "name", "included_req_ids")
            ),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=IntegrationArchitecture,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level())
        ],
    )
