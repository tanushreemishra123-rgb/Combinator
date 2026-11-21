"""Data strategy, integration architecture, AI approach and technology sections."""

from app.domain.artifacts import (
    AiUseCase,
)
from app.domain.package import Block
from app.domain.scope import ItemType
from app.package.blocks import code, heading, image, missing, paragraph, table
from app.package.diagrams import (
    INTEGRATION_DIAGRAM_ID,
    integration_mermaid,
)
from app.package.labels import area_title, grounding, humanise
from app.package.sections.common import (
    NONE,
    Ctx,
    flow_table,
    join,
    narrative,
    requirement_table,
    services_for,
    statement_bullets,
    text,
)


def data_strategy(ctx: Ctx) -> list[Block]:
    strategy = ctx.artifacts.data_strategy
    if strategy is None:
        return [missing("The data strategy artifact has not been generated.")]
    architecture = ctx.artifacts.architecture
    out: list[Block] = []
    if strategy.domains:
        out += [
            heading("Data domains", 3),
            table(
                ["ID", "Domain", "Description", "Sources", "Owner", "Grounding"],
                [
                    [
                        d.id,
                        d.name,
                        text(d.description),
                        join(d.sources),
                        text(d.owner),
                        grounding(d),
                    ]
                    for d in strategy.domains
                ],
            ),
        ]
    for title, section in (
        ("Data ingestion", strategy.ingestion),
        ("Transactional storage", strategy.transactional_storage),
        ("Analytical storage", strategy.analytical_storage),
        ("Data quality", strategy.quality),
        ("Metadata and governance", strategy.metadata_governance),
        ("Data retention", strategy.retention),
        ("Privacy and security", strategy.privacy_security),
        ("Reporting and analytics", strategy.reporting_analytics),
        ("Backup and recovery", strategy.backup_recovery),
    ):
        out += narrative(title, section, architecture)
    return out


def integration_architecture(ctx: Ctx) -> list[Block]:
    integration = ctx.artifacts.integration_architecture
    if integration is None:
        return [missing("The integration architecture artifact has not been generated.")]
    architecture = ctx.artifacts.architecture
    out: list[Block] = [
        code(integration_mermaid(integration), language="mermaid"),
        image(INTEGRATION_DIAGRAM_ID, "Figure 2. Integration and data flow."),
    ]
    if integration.integrations:
        out += [
            heading("Integrations", 3),
            table(
                [
                    "ID",
                    "Integration",
                    "Source",
                    "Target",
                    "Direction",
                    "Pattern",
                    "Cloud services",
                    "Grounding",
                ],
                [
                    [
                        i.id,
                        i.name,
                        i.source_system,
                        i.target_system,
                        humanise(i.direction),
                        humanise(i.pattern),
                        services_for(i.arc_ids, architecture) or NONE,
                        grounding(i),
                    ]
                    for i in integration.integrations
                ],
            ),
            heading("Integration operations", 3),
            table(
                [
                    "ID",
                    "Authentication",
                    "Error handling",
                    "Retry behaviour",
                    "Monitoring",
                    "Synchronization",
                ],
                [
                    [
                        i.id,
                        text(i.auth_approach),
                        text(i.error_handling),
                        text(i.retry_behavior),
                        text(i.monitoring),
                        text(i.sync_considerations),
                    ]
                    for i in integration.integrations
                ],
            ),
        ]
    for title, systems in (
        ("Internal systems", integration.internal_systems),
        ("External systems", integration.external_systems),
    ):
        if systems:
            out += [
                heading(title, 3),
                table(
                    ["System", "Role", "Grounding"],
                    [[s.name, text(s.description), grounding(s)] for s in systems],
                ),
            ]
    if integration.flows:
        out += [heading("Information movement", 3), flow_table(integration.flows)]
    return out


def ai_solution_approach(ctx: Ctx) -> list[Block]:
    strategy = ctx.artifacts.ai_strategy
    if strategy is None:
        return [missing("The AI strategy artifact has not been generated.")]
    architecture = ctx.artifacts.architecture
    out: list[Block] = [paragraph(f"Recommended AI pattern: {text(strategy.architecture_pattern)}")]
    ai_services = services_for(
        [c.id for c in architecture.components if c.area.value == "ai_and_ml_services"]
        if architecture
        else [],
        architecture,
    )
    if ai_services:
        out.append(paragraph(f"AI and ML cloud services: {ai_services}"))
    if strategy.ai_requirements:
        out += [
            heading("AI-specific requirements", 3),
            statement_bullets(strategy.ai_requirements),
        ]
    if strategy.use_cases:
        out += [
            heading("AI use cases", 3),
            table(
                [
                    "ID",
                    "Use case",
                    "Description",
                    "Processing class",
                    "Pattern",
                    "Model options",
                    "Grounding",
                ],
                [
                    [
                        u.id,
                        u.name,
                        text(u.description),
                        humanise(u.processing_class),
                        text(u.pattern),
                        join(u.model_options),
                        grounding(u),
                    ]
                    for u in strategy.use_cases
                ],
            ),
            heading("AI use case design", 3),
            table(
                ["ID", "Retrieval", "Orchestration", "Prompt and structured output", "Evaluation"],
                [
                    [
                        u.id,
                        _retrieval(u),
                        text(u.orchestration),
                        text(u.prompt_and_structured_output),
                        text(u.evaluation),
                    ]
                    for u in strategy.use_cases
                ],
            ),
            heading("Responsible AI, monitoring and human review", 3),
            table(
                [
                    "ID",
                    "Responsible AI and safety",
                    "Monitoring and feedback",
                    "Human review",
                    "Data privacy",
                ],
                [
                    [
                        u.id,
                        text(u.responsible_ai_safety),
                        text(u.monitoring_feedback),
                        text(u.human_review),
                        text(u.data_privacy),
                    ]
                    for u in strategy.use_cases
                ],
            ),
        ]
    if strategy.deterministic_areas:
        out += [
            heading("Deterministic processing areas", 3),
            statement_bullets(strategy.deterministic_areas),
        ]
    if strategy.mandatory_human_decisions:
        out += [
            heading("Decisions that stay with a human", 3),
            statement_bullets(strategy.mandatory_human_decisions),
        ]
    return out


def _retrieval(use_case: AiUseCase) -> str:
    if not use_case.retrieval_required:
        return "Not required"
    return text(use_case.retrieval_notes)


def recommended_technologies(ctx: Ctx) -> list[Block]:
    strategy = ctx.artifacts.ai_strategy
    architecture = ctx.artifacts.architecture
    out: list[Block] = []
    if strategy is not None and strategy.framework_recommendations:
        out += [
            heading("Frameworks and services", 3),
            table(
                ["Name", "Purpose", "Rationale", "Alternatives considered", "Grounding"],
                [
                    [
                        f.name,
                        text(f.purpose),
                        text(f.rationale),
                        join(f.alternatives_considered),
                        grounding(f),
                    ]
                    for f in strategy.framework_recommendations
                ],
            ),
        ]
    if strategy is not None and strategy.provider_options:
        platform = architecture.platform.value if architecture else None
        options = [
            o
            for o in strategy.provider_options
            if platform is None or o.platform.value in (platform, "any")
        ]
        out += [
            heading("Model and provider options", 3),
            table(
                ["Platform", "Provider", "Models", "Rationale"],
                [
                    [humanise(o.platform), o.provider, join(o.models), text(o.rationale)]
                    for o in options
                ],
            ),
        ]
    if architecture is not None and architecture.components:
        out += [
            heading("Cloud services selected", 3),
            table(
                ["Area", "Component", "Cloud service"],
                [[area_title(c.area), c.name, c.cloud_service] for c in architecture.components],
            ),
        ]
    preferences = ctx.of_type(ItemType.TECHNOLOGY_PREFERENCE)
    if preferences:
        out += [heading("Customer technology preferences", 3), requirement_table(preferences)]
    if not out:
        return [missing("No technology or framework recommendations have been generated.")]
    return out
