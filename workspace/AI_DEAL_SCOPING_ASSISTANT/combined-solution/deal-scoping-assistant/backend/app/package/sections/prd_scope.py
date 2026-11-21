"""PRD and functional scope sections."""

from app.domain.package import Block
from app.package.blocks import heading, missing, paragraph, table
from app.package.labels import grounding, humanise
from app.package.sections.common import (
    NONE,
    Ctx,
    join,
    out_of_scope_bullets,
    statement_bullets,
    text,
)


def prd(ctx: Ctx) -> list[Block]:
    document = ctx.artifacts.prd
    if document is None:
        return [missing("The PRD artifact has not been generated.")]
    out: list[Block] = [
        heading("Solution overview", 3),
        paragraph(text(document.overview)),
        heading("Business problem", 3),
        paragraph(text(document.business_problem)),
    ]
    if document.objectives:
        out += [heading("Business objectives", 3), statement_bullets(document.objectives)]
    if document.personas:
        out += [
            heading("Target users and personas", 3),
            table(
                ["Persona", "Description", "Needs", "Grounding"],
                [
                    [p.name, text(p.description), join(p.needs), grounding(p)]
                    for p in document.personas
                ],
            ),
        ]
    if document.user_journeys:
        out += [
            heading("User journeys", 3),
            table(
                ["Journey", "Actor", "Steps", "Grounding"],
                [
                    [j.name, text(j.actor), " -> ".join(j.steps) or NONE, grounding(j)]
                    for j in document.user_journeys
                ],
            ),
        ]
    for title, requirements in (
        ("Functional requirements", document.functional_requirements),
        ("Non-functional requirements", document.non_functional_requirements),
    ):
        if requirements:
            out += [
                heading(title, 3),
                table(
                    ["Requirement ID", "Statement", "Acceptance conditions", "Grounding"],
                    [
                        [r.req_id, text(r.statement), join(r.acceptance_conditions), grounding(r)]
                        for r in requirements
                    ],
                ),
            ]
    for title, statements in (
        ("Integrations", document.integrations),
        ("Dependencies", document.dependencies),
        ("Assumptions", document.assumptions),
        ("Risks", document.risks),
        ("Open questions", document.open_questions),
    ):
        if statements:
            out += [heading(title, 3), statement_bullets(statements)]
    if document.out_of_scope:
        out += [heading("Out of scope", 3), out_of_scope_bullets(document.out_of_scope)]
    if document.traceability:
        out += [
            heading("Requirement traceability", 3),
            table(
                ["Requirement ID", "PRD sections"],
                [[t.req_id, join(t.sections)] for t in document.traceability],
            ),
        ]
    return out


def functional_scope(ctx: Ctx) -> list[Block]:
    scope = ctx.artifacts.functional_scope
    if scope is None:
        return [missing("The functional scope artifact has not been generated.")]
    out: list[Block] = []
    if scope.capabilities:
        out += [
            heading("Capabilities", 3),
            table(
                [
                    "ID",
                    "Capability",
                    "Description",
                    "Priority",
                    "Scope class",
                    "Requirements",
                    "Module",
                    "Workstream",
                    "Delivery package",
                    "Grounding",
                ],
                [
                    [
                        c.id,
                        c.name,
                        text(c.description),
                        humanise(c.priority),
                        humanise(c.scope_class),
                        join(c.included_req_ids),
                        text(c.module),
                        text(c.workstream_id),
                        text(c.delivery_package_id),
                        grounding(c),
                    ]
                    for c in scope.capabilities
                ],
            ),
        ]
    for title, groups in (
        ("Modules", scope.modules),
        ("Workstreams", scope.workstreams),
    ):
        if groups:
            out += [
                heading(title, 3),
                table(
                    ["ID", "Name", "Capabilities", "Grounding"],
                    [[g.id, g.name, join(g.capability_ids), grounding(g)] for g in groups],
                ),
            ]
    if scope.delivery_packages:
        out += [
            heading("Delivery packages", 3),
            table(
                ["ID", "Name", "Capabilities", "Engagement model", "Grounding"],
                [
                    [
                        p.id,
                        p.name,
                        join(p.capability_ids),
                        humanise(p.engagement_model),
                        grounding(p),
                    ]
                    for p in scope.delivery_packages
                ],
            ),
        ]
    if scope.recommended_enhancements:
        out += [
            heading("Recommended enhancements", 3),
            table(
                ["ID", "Enhancement", "Rationale", "Related requirements", "Grounding"],
                [
                    [
                        e.id,
                        text(e.description),
                        text(e.rationale),
                        join(e.related_req_ids),
                        grounding(e),
                    ]
                    for e in scope.recommended_enhancements
                ],
            ),
        ]
    if scope.out_of_scope:
        out += [heading("Out of scope", 3), out_of_scope_bullets(scope.out_of_scope)]
    return out
