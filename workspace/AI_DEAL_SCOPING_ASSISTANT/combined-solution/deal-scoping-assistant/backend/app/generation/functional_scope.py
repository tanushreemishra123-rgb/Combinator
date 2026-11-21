"""S3: functional scope."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import functional_scope as stage
from app.domain.artifacts import FunctionalScope, ScopeClass
from app.domain.scope import ItemType, Origin, ScopeItem
from app.generation.common import run


def generate_functional_scope(ctx: GenerationContext) -> tuple[FunctionalScope, list[Finding]]:
    scope, findings = run(ctx, stage.build(ctx))
    classify_capabilities(scope, ctx.active_items())
    return scope, findings


def classify_capabilities(scope: FunctionalScope, items: list[ScopeItem]) -> None:
    """Set each capability's scope class from what its requirements are.

    The class follows the origin of the linked items, so it is a fact, not a judgement:
    one customer-stated requirement makes the capability customer requested; only inferred
    requirements make it an AI interpretation; only assumptions leave it pending.
    """
    origin_by_id = {item.id: item.origin for item in items}
    for capability in scope.capabilities:
        origins = {origin_by_id[i] for i in capability.included_req_ids if i in origin_by_id}
        linked_assumptions = any(
            i.startswith(f"{ItemType.ASSUMPTION.value}_") for i in capability.included_req_ids
        )
        if Origin.CUSTOMER_STATED in origins:
            capability.scope_class = ScopeClass.CUSTOMER_REQUESTED
        elif Origin.AI_INFERRED in origins:
            capability.scope_class = ScopeClass.AI_INTERPRETED
        elif linked_assumptions or Origin.ASSUMED in origins:
            capability.scope_class = ScopeClass.ASSUMPTION_PENDING
