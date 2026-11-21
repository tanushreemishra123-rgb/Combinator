"""S2: PRD."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import prd as stage
from app.domain.artifacts import Prd
from app.generation.common import run


def generate_prd(ctx: GenerationContext) -> tuple[Prd, list[Finding]]:
    content, findings = run(ctx, stage.build(ctx))
    return stage.with_traceability(content), findings
