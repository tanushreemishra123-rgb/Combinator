"""S8: AI solution approach."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import ai_strategy as stage
from app.domain.artifacts import AiStrategy
from app.generation.common import run


def generate_ai_strategy(ctx: GenerationContext) -> tuple[AiStrategy, list[Finding]]:
    return run(ctx, stage.build(ctx))
