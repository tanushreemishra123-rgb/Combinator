"""S9: estimate drivers. The numbers come from the estimation engine, not from here."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import estimate_drivers as stage
from app.domain.artifacts import EstimateDrivers
from app.generation.common import run


def generate_estimate_drivers(ctx: GenerationContext) -> tuple[EstimateDrivers, list[Finding]]:
    return run(ctx, stage.build(ctx))
