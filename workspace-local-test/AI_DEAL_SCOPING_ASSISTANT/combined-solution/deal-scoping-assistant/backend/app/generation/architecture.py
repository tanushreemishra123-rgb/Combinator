"""S4 and S5: platform recommendation and the cloud architecture."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import architecture as stage
from app.ai.stages import recommend_platform as platform_stage
from app.core.errors import ValidationFailed
from app.domain.artifacts import Architecture, PlatformRecommendation
from app.domain.scope import CloudPlatform
from app.generation.common import run


def recommend_platform(ctx: GenerationContext) -> tuple[PlatformRecommendation, list[Finding]]:
    return run(ctx, platform_stage.build(ctx))


def generate_architecture(
    ctx: GenerationContext,
    platform: CloudPlatform | None = None,
    recommendation: PlatformRecommendation | None = None,
) -> tuple[Architecture, list[Finding]]:
    """Design for the given platform; the caller passes the recommendation when there is one."""
    target = platform or ctx.platform or (recommendation.recommended if recommendation else None)
    if target is None:
        raise ValidationFailed("a cloud platform is required to generate the architecture")
    draft, findings = run(ctx, stage.build(ctx, target))
    return stage.to_architecture(draft, target, recommendation), findings
