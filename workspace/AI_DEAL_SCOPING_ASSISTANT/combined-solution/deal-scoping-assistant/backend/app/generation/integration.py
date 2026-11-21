"""S7: integration architecture."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import integration_architecture as stage
from app.domain.artifacts import IntegrationArchitecture
from app.generation.common import run


def generate_integration_architecture(
    ctx: GenerationContext,
) -> tuple[IntegrationArchitecture, list[Finding]]:
    return run(ctx, stage.build(ctx))
