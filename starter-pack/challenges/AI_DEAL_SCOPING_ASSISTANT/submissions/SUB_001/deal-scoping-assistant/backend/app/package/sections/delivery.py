"""Delivery phases, effort and timeline, and ROM commercial sections."""

from app.domain.package import Block
from app.package.blocks import bullets, heading, missing, paragraph, table
from app.package.labels import grounding, humanise
from app.package.sections.common import (
    Ctx,
    join,
    statement_bullets,
    trace_rows,
)


def delivery_phases(ctx: Ctx) -> list[Block]:
    drivers = ctx.artifacts.estimate_drivers
    if drivers is None:
        return [missing("The estimate drivers artifact has not been generated.")]
    out: list[Block] = []
    if drivers.phases:
        out += [
            heading("Delivery phases", 3),
            table(
                ["Phase", "Workstreams", "Milestones"],
                [[p.name, join(p.workstream_ids), join(p.milestones)] for p in drivers.phases],
            ),
        ]
    if drivers.workstreams:
        out += [
            heading("Workstreams", 3),
            table(
                [
                    "ID",
                    "Workstream",
                    "Complexity",
                    "Capabilities",
                    "Integrations",
                    "AI use cases",
                    "Data domains",
                    "Roles",
                    "Grounding",
                ],
                [
                    [
                        w.id,
                        w.name,
                        humanise(w.derived_complexity),
                        join(w.capability_ids),
                        join(w.integration_ids),
                        join(w.ai_use_case_ids),
                        join(w.domain_ids),
                        join(w.roles),
                        grounding(w),
                    ]
                    for w in drivers.workstreams
                ],
            ),
        ]
    if drivers.units:
        out += [
            heading("Estimated units and complexity drivers", 3),
            table(
                ["Unit", "Type", "Workstream", "Complexity", "Drivers"],
                [
                    [
                        u.unit_id,
                        humanise(u.unit_type),
                        u.workstream_id,
                        humanise(u.complexity),
                        join(u.drivers),
                    ]
                    for u in drivers.units
                ],
            ),
        ]
    if drivers.exclusions:
        out += [heading("Excluded from the estimate", 3), statement_bullets(drivers.exclusions)]
    return out


def effort_and_timeline(ctx: Ctx) -> list[Block]:
    estimate = ctx.estimate
    if estimate is None:
        return [missing("The estimate has not been calculated.")]
    summary = (
        f"Total base effort: {estimate.effort_low:g} to {estimate.effort_high:g} person-weeks. "
        f"Including contingency: {estimate.effort_incl_contingency_low:g} to "
        f"{estimate.effort_incl_contingency_high:g} person-weeks. "
        f"Timeline: {estimate.timeline_weeks_low:g} to {estimate.timeline_weeks_high:g} weeks. "
        f"Overall confidence: {humanise(estimate.overall_confidence)}."
    )
    out: list[Block] = [
        paragraph(summary),
        heading("Effort by workstream", 3),
        table(
            [
                "ID",
                "Workstream",
                "Complexity",
                "Effort low",
                "Effort high",
                "Roles",
                "Confidence",
                "Limitations",
                "Status",
            ],
            [
                [
                    w.workstream_id,
                    w.name,
                    humanise(w.complexity),
                    f"{w.effort_low:g}",
                    f"{w.effort_high:g}",
                    join(w.roles),
                    humanise(w.confidence),
                    join(w.limitations),
                    w.blocked_reason if w.blocked else "Calculated",
                ]
                for w in estimate.workstreams
            ],
        ),
    ]
    if estimate.phases:
        out += [
            heading("Timeline by phase", 3),
            table(
                ["Phase", "Workstreams", "Weeks low", "Weeks high", "Milestones"],
                [
                    [
                        p.name,
                        join(p.workstream_ids),
                        f"{p.weeks_low:g}",
                        f"{p.weeks_high:g}",
                        join(
                            [
                                f"{m.name} (week {m.week_low:g}-{m.week_high:g})"
                                for m in p.milestones
                            ]
                        ),
                    ]
                    for p in estimate.phases
                ],
            ),
        ]
    if estimate.confidence_limitations:
        out += [heading("Confidence limitations", 3), bullets(estimate.confidence_limitations)]
    if estimate.deadline_risk.strip():
        out.append(paragraph(f"Deadline risk: {estimate.deadline_risk}"))
    workstream_trace: list[list[str]] = []
    for workstream in estimate.workstreams:
        workstream_trace += trace_rows(workstream.trace, prefix=workstream.workstream_id)
    if workstream_trace:
        out += [
            heading("Workstream calculation trace", 3),
            table(["Workstream", "Step", "Formula", "Inputs", "Result"], workstream_trace),
        ]
    return out


def rom_commercials(ctx: Ctx) -> list[Block]:
    estimate = ctx.estimate
    if estimate is None:
        return [missing("The estimate has not been calculated, so there are no ROM commercials.")]
    rom = estimate.rom
    # No rate card means no currency: say so instead of printing a range without a unit.
    rom_range = (
        f"ROM range: {rom.amount_low:,.0f} to {rom.amount_high:,.0f} {rom.currency}. "
        if rom.currency
        else "ROM range: not calculable, no rate card is selected. "
    )
    commercial_summary = (
        f"{rom_range}"
        f"Rate basis: {humanise(rom.rate_basis)}. "
        f"Contingency: {rom.contingency_pct:g}% applied once. "
        f"Rate card: {estimate.rate_card_id}. "
        f"Confidence: {humanise(estimate.overall_confidence)}."
    )
    out: list[Block] = [
        paragraph(commercial_summary),
        heading("Calculation basis", 3),
        table(["Step", "Formula", "Inputs", "Result"], trace_rows(estimate.trace)),
    ]
    if estimate.blocked_lines:
        out += [
            heading("Lines that cannot be calculated", 3),
            table(
                ["Line", "Reason"],
                [[b.label, b.reason] for b in estimate.blocked_lines],
            ),
        ]
    out.append(
        paragraph(
            "These values are a rough order of magnitude derived from the visible estimation "
            "factors above. They are not a quotation."
        )
    )
    return out
