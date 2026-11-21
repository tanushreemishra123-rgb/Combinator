"""S6: data strategy."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import data_strategy as stage
from app.domain.artifacts import DataStrategy
from app.generation.common import run


def generate_data_strategy(ctx: GenerationContext) -> tuple[DataStrategy, list[Finding]]:
    return run(ctx, stage.build(ctx))
