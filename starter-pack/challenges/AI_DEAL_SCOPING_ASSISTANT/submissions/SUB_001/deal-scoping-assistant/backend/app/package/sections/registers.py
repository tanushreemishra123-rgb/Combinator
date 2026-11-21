"""Assumption, risk, dependency and open question registers."""

from app.domain.package import Block
from app.domain.scope import ItemType
from app.package.blocks import heading, missing, table
from app.package.sections.common import (
    NONE,
    Ctx,
    join,
    quote,
    requirement_table,
    statement_bullets,
    text,
)


def assumptions(ctx: Ctx) -> list[Block]:
    out: list[Block] = []
    recorded = ctx.of_type(ItemType.ASSUMPTION)
    if recorded:
        out += [
            heading("Reviewed assumptions", 3),
            table(
                ["ID", "Assumption", "Priority", "Confirmation", "Impact if wrong", "Source"],
                [
                    [
                        item.id,
                        text(item.description or item.title),
                        item.priority.value,
                        item.details.assumption.confirmation_status.value
                        if item.details.assumption
                        else NONE,
                        item.details.assumption.impact_if_wrong
                        if item.details.assumption
                        else NONE,
                        quote(item),
                    ]
                    for item in recorded
                ],
            ),
        ]
    drivers = ctx.artifacts.estimate_drivers
    if drivers is not None and drivers.estimation_assumptions:
        out += [
            heading("Estimation assumptions", 3),
            statement_bullets(drivers.estimation_assumptions),
        ]
    if not out:
        return [missing("No assumptions have been recorded.")]
    return out


def risks(ctx: Ctx) -> list[Block]:
    out: list[Block] = []
    recorded = ctx.of_type(ItemType.RISK)
    if recorded:
        out += [heading("Risks from the customer requirements", 3), requirement_table(recorded)]
    drivers = ctx.artifacts.estimate_drivers
    if drivers is not None and drivers.delivery_risks:
        out += [heading("Delivery risks", 3), statement_bullets(drivers.delivery_risks)]
    if not out:
        return [missing("No risks have been recorded.")]
    return out


def dependencies(ctx: Ctx) -> list[Block]:
    out: list[Block] = []
    recorded = ctx.of_type(ItemType.DEPENDENCY)
    if recorded:
        out += [
            heading("Dependencies from the customer requirements", 3),
            requirement_table(recorded),
        ]
    drivers = ctx.artifacts.estimate_drivers
    if drivers is not None and drivers.workstreams:
        rows = [[w.id, w.name, join(w.dependencies)] for w in drivers.workstreams if w.dependencies]
        if rows:
            out += [
                heading("Workstream dependencies", 3),
                table(["Workstream", "Name", "Dependencies"], rows),
            ]
    if not out:
        return [missing("No dependencies have been recorded.")]
    return out


def open_questions(ctx: Ctx) -> list[Block]:
    out: list[Block] = []
    questions = ctx.of_type(ItemType.CLARIFICATION_QUESTION)
    if questions:
        out += [
            heading("Clarification questions", 3),
            table(
                [
                    "ID",
                    "Question",
                    "Priority",
                    "Why it matters",
                    "Affected IDs",
                    "Status",
                    "Answer",
                ],
                [
                    [
                        item.id,
                        text(item.description or item.title),
                        item.priority.value,
                        item.details.question.why_it_matters if item.details.question else NONE,
                        join(item.details.question.affected_ids) if item.details.question else NONE,
                        item.details.question.answer_status.value
                        if item.details.question
                        else NONE,
                        text(item.details.question.answer) if item.details.question else NONE,
                    ]
                    for item in questions
                ],
            ),
        ]
    gaps = ctx.of_type(ItemType.MISSING_INFORMATION)
    if gaps:
        out += [
            heading("Missing information", 3),
            table(
                [
                    "ID",
                    "Missing information",
                    "Criticality",
                    "Impacted areas",
                    "Question",
                    "Assumption",
                ],
                [
                    [
                        item.id,
                        text(item.description or item.title),
                        item.details.gap.criticality.value if item.details.gap else NONE,
                        join(item.details.gap.impacted_areas) if item.details.gap else NONE,
                        text(item.details.gap.question_id) if item.details.gap else NONE,
                        text(item.details.gap.assumption_id) if item.details.gap else NONE,
                    ]
                    for item in gaps
                ],
            ),
        ]
    if not out:
        return [missing("No open questions or information gaps have been recorded.")]
    return out
