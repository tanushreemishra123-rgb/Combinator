"""S11: executive summary. `commercial_summary` is written by the caller, not by the model."""

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.stages import executive_summary as stage
from app.domain.artifacts import ExecutiveSummary
from app.generation.common import run


def generate_executive_summary(
    ctx: GenerationContext, commercial_summary: str = ""
) -> tuple[ExecutiveSummary, list[Finding]]:
    """`commercial_summary` comes from the deterministic estimate summary string."""
    draft, findings = run(ctx, stage.build(ctx))
    return stage.to_executive_summary(draft, commercial_summary), findings
