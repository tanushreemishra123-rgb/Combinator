"""Assembles the integrated scoping package into one renderer-neutral `DocumentModel`.

Section order comes from the shared outline seed, so the export, the in-app preview
and the plan cannot drift apart. Everything here is pure: domain objects in, model out.
The sections themselves live in `app/package/sections`.
"""

from collections.abc import Callable, Sequence
from datetime import UTC, datetime

from app.domain.estimation import Estimate
from app.domain.package import Block, DocumentModel, Section
from app.domain.quality import QualityReport
from app.domain.scope import ItemStatus, ScopeItem, SessionRead
from app.package.errors import OutlineError
from app.package.inputs import PackageArtifacts
from app.package.labels import ai_mode_title, humanise
from app.package.outline import load_outline
from app.package.sections import architecture, assurance, delivery, prd_scope, registers
from app.package.sections import strategy as strategy_sections
from app.package.sections import summary as summary_sections
from app.package.sections.common import Ctx
from app.traceability.coverage import CoverageReport

# Outline id -> the function that builds that section's blocks.
SECTION_BUILDERS: dict[str, Callable[[Ctx], list[Block]]] = {
    "PKG_01": summary_sections.executive_summary,
    "PKG_02": summary_sections.customer_objectives,
    "PKG_03": summary_sections.requirement_summary,
    "PKG_04": prd_scope.prd,
    "PKG_05": prd_scope.functional_scope,
    "PKG_06": architecture.solution_architecture,
    "PKG_07": architecture.architecture_diagram,
    "PKG_08": strategy_sections.data_strategy,
    "PKG_09": strategy_sections.integration_architecture,
    "PKG_10": strategy_sections.ai_solution_approach,
    "PKG_11": strategy_sections.recommended_technologies,
    "PKG_12": delivery.delivery_phases,
    "PKG_13": delivery.effort_and_timeline,
    "PKG_14": delivery.rom_commercials,
    "PKG_15": registers.assumptions,
    "PKG_16": registers.risks,
    "PKG_17": registers.dependencies,
    "PKG_18": registers.open_questions,
    "PKG_19": assurance.requirement_coverage,
    "PKG_20": assurance.traceability,
    "PKG_21": assurance.quality_gate,
}


def build_package(
    session: SessionRead,
    scope_items: Sequence[ScopeItem],
    artifacts: PackageArtifacts,
    estimate: Estimate | None,
    coverage: CoverageReport | None,
    quality_report: QualityReport | None,
    generated_at: datetime | None = None,
) -> DocumentModel:
    """Build the whole package; missing artifacts become a clear gap note, never a crash."""
    ctx = Ctx(
        session=session,
        items=[item for item in scope_items if item.status is not ItemStatus.REJECTED],
        artifacts=artifacts,
        estimate=estimate,
        coverage=coverage,
        quality=quality_report,
    )
    sections = []
    for outline_section in load_outline():
        builder = SECTION_BUILDERS.get(outline_section.id)
        if builder is None:
            raise OutlineError(
                f"outline section {outline_section.id} ({outline_section.title}) has no builder"
            )
        sections.append(
            Section(
                id=outline_section.id,
                title=outline_section.title,
                blocks=builder(ctx),
            )
        )
    customer = session.customer_name.strip() or session.name.strip()
    platform = humanise(session.cloud_platform) if session.cloud_platform else "Not selected"
    return DocumentModel(
        title=f"Solution Scoping Package - {customer}",
        subtitle=(
            f"{session.name} - scope version {session.scope_version} - "
            f"cloud platform {platform} - "
            f"AI mode {ai_mode_title(session.ai_mode, artifacts.generated_by)}"
        ),
        generated_at=generated_at or datetime.now(UTC),
        sections=sections,
    )
