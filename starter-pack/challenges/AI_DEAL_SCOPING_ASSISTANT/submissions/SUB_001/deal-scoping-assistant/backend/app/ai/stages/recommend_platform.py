"""S4: recommend a cloud platform when the user did not select one."""

from functools import partial

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, items_view, load_prompt
from app.ai.validators.id_references import check_id_references
from app.domain.artifacts import PlatformRecommendation
from app.domain.scope import ItemType

STAGE = "recommend_platform"

_RELEVANT = (
    ItemType.TECHNOLOGY_PREFERENCE,
    ItemType.NON_FUNCTIONAL_REQUIREMENT,
    ItemType.SECURITY_COMPLIANCE,
    ItemType.EXISTING_SYSTEM,
    ItemType.INTEGRATION,
    ItemType.DATA_REQUIREMENT,
    ItemType.DELIVERY_CONSTRAINT,
    ItemType.ASSUMPTION,
)


def build(ctx: GenerationContext) -> StageRequest[PlatformRecommendation]:
    user = as_json(
        {
            "customer": ctx.customer_name,
            "config": config_view(ctx.config),
            "scope_items": items_view(ctx.items_of(*_RELEVANT)),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=PlatformRecommendation,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level())
        ],
    )
