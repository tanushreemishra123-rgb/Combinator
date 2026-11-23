"""Solution architecture and architecture diagram sections."""

from app.domain.artifacts import (
    ArchitectureComponent,
)
from app.domain.package import Block
from app.package.blocks import code, heading, image, missing, paragraph, table
from app.package.diagrams import (
    ARCHITECTURE_DIAGRAM_ID,
    architecture_mermaid,
)
from app.package.labels import area_title, grounding, humanise, with_grounding
from app.package.sections.common import (
    Ctx,
    flow_table,
    item_titles,
    join,
    narrative,
    text,
)


def solution_architecture(ctx: Ctx) -> list[Block]:
    architecture = ctx.artifacts.architecture
    if architecture is None:
        return [missing("The architecture artifact has not been generated.")]
    out: list[Block] = [paragraph(f"Cloud platform: {humanise(architecture.platform)}.")]
    recommendation = architecture.platform_recommendation
    if recommendation is not None:
        recommended = (
            f"Recommended: {humanise(recommendation.recommended)}. {recommendation.rationale}"
        )
        out += [
            heading("Platform recommendation", 3),
            paragraph(with_grounding(recommended, recommendation)),
        ]
        if recommendation.alternatives:
            out.append(
                table(
                    ["Alternative", "Why not"],
                    [[humanise(a.platform), text(a.why_not)] for a in recommendation.alternatives],
                )
            )
    by_area: dict[str, list[ArchitectureComponent]] = {}
    for component in architecture.components:
        by_area.setdefault(component.area.value, []).append(component)
    for components in by_area.values():
        out += [
            heading(area_title(components[0].area), 3),
            table(
                ["ID", "Component", "Cloud service", "Supported IDs", "Purpose", "Grounding"],
                [
                    [
                        c.id,
                        c.name,
                        c.cloud_service,
                        join(c.supported_ids),
                        text(c.purpose),
                        grounding(c),
                    ]
                    for c in components
                ],
            ),
            table(
                [
                    "ID",
                    "Rationale",
                    "Trade-offs",
                    "Dependencies",
                    "Security considerations",
                    "Environments",
                ],
                [
                    [
                        c.id,
                        text(c.rationale),
                        join(c.trade_offs),
                        join(c.dependencies),
                        text(c.security_considerations),
                        join(c.environments),
                    ]
                    for c in components
                ],
            ),
        ]
    out += [
        heading("Environments", 3),
        table(
            ["Environment", "Approach"],
            [
                [humanise("dev"), text(architecture.environments.dev)],
                [humanise("test"), text(architecture.environments.test)],
                [humanise("prod"), text(architecture.environments.prod)],
            ],
        ),
    ]
    for title, section in (
        ("Deployment and runtime", architecture.deployment_runtime),
        ("Availability and scalability", architecture.availability_scalability),
        ("Backup and disaster recovery", architecture.backup_dr),
        ("Observability and monitoring", architecture.observability),
        ("Security controls", architecture.security_controls),
    ):
        out += narrative(title, section, architecture)
    return out


def architecture_diagram(ctx: Ctx) -> list[Block]:
    architecture = ctx.artifacts.architecture
    if architecture is None:
        return [
            missing("The architecture artifact has not been generated, so there is no diagram.")
        ]
    return [
        code(architecture_mermaid(architecture, item_titles(ctx)), language="mermaid"),
        image(ARCHITECTURE_DIAGRAM_ID, "Figure 1. Proposed solution architecture."),
        heading("Components shown in the diagram", 3),
        table(
            ["ID", "Component", "Area", "Cloud service"],
            [[c.id, c.name, area_title(c.area), c.cloud_service] for c in architecture.components],
        ),
        heading("Flows shown in the diagram", 3),
        flow_table(architecture.flows),
    ]
