"""Executive summary, customer objectives and requirement summary sections."""

from app.domain.package import Block
from app.domain.scope import ItemType, Priority
from app.package.blocks import heading, missing, paragraph, table
from app.package.sections.common import (
    Ctx,
    requirement_table,
    statement_bullets,
    text,
)


def executive_summary(ctx: Ctx) -> list[Block]:
    summary = ctx.artifacts.executive_summary
    if summary is None:
        return [missing("The executive summary artifact has not been generated.")]
    out = [paragraph(text(summary.overview))]
    if summary.solution_highlights:
        out += [heading("Solution highlights", 3), statement_bullets(summary.solution_highlights)]
    if summary.commercial_summary.strip():
        out += [heading("Commercial summary", 3), paragraph(summary.commercial_summary)]
    if summary.key_risks:
        out += [heading("Key risks", 3), statement_bullets(summary.key_risks)]
    if summary.next_steps:
        out += [heading("Next steps", 3), statement_bullets(summary.next_steps)]
    return out


def customer_objectives(ctx: Ctx) -> list[Block]:
    out: list[Block] = []
    if ctx.session.opportunity_context.strip():
        out.append(paragraph(ctx.session.opportunity_context.strip()))
    summary = ctx.artifacts.executive_summary
    if summary is not None and summary.customer_objectives:
        out.append(statement_bullets(summary.customer_objectives))
    objectives = ctx.of_type(ItemType.BUSINESS_OBJECTIVE)
    if objectives:
        out += [
            heading("Business objectives from the customer text", 3),
            requirement_table(objectives),
        ]
    else:
        out.append(missing("No business objectives were extracted from the customer text."))
    return out


def requirement_summary(ctx: Ctx) -> list[Block]:
    if not ctx.items:
        return [missing("No requirements have been extracted yet.")]
    counts: list[list[str]] = []
    for item_type in ItemType:
        typed = ctx.of_type(item_type)
        if not typed:
            continue
        top = sum(1 for i in typed if i.priority in (Priority.MUST, Priority.HIGH))
        by_origin = {
            origin: sum(1 for i in typed if i.origin.value == origin)
            for origin in ("customer_stated", "ai_inferred", "assumed")
        }
        counts.append(
            [
                item_type.value,
                str(len(typed)),
                str(top),
                str(by_origin["customer_stated"]),
                str(by_origin["ai_inferred"]),
                str(by_origin["assumed"]),
            ]
        )
    detailed = [
        item
        for item in ctx.items
        if item.type
        not in (ItemType.ASSUMPTION, ItemType.CLARIFICATION_QUESTION, ItemType.MISSING_INFORMATION)
    ]
    return [
        table(
            ["Type", "Count", "Must or high", "Customer-stated", "AI-inferred", "Assumed"],
            counts,
        ),
        heading("Reviewed requirements", 3),
        requirement_table(detailed),
    ]
