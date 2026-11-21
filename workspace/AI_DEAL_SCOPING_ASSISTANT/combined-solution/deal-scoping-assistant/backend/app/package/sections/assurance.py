"""Requirement coverage, traceability and quality gate sections."""

from app.domain.package import Block
from app.domain.quality import CheckId, CheckStatus
from app.domain.scope import AnswerStatus, ItemType
from app.package.blocks import bullets, heading, missing, paragraph, table
from app.package.labels import basis_title, humanise
from app.package.sections.common import (
    NONE,
    Ctx,
    artifact_models,
    element_label,
    iter_elements,
    join,
    quote,
    text,
)
from app.traceability.coverage import CoverageColumn, CoverageReport

# Inconsistency checks named by the spec's quality-gate list.
_INCONSISTENCY_CHECKS = {CheckId.QG_09, CheckId.QG_10, CheckId.QG_13}


def requirement_coverage(ctx: Ctx) -> list[Block]:
    coverage = ctx.coverage
    if coverage is None:
        return [missing("Requirement coverage has not been computed.")]
    summary = (
        f"Requirement coverage: {coverage.coverage_pct:g}% "
        f"({coverage.covered_count} of {coverage.counted_count} counted requirements). "
        f"Must and high priority coverage: {coverage.high_priority_pct:g}% "
        f"({coverage.high_priority_covered_count} of {coverage.high_priority_count}). "
        f"Uncovered requirements: {len(coverage.uncovered_ids)}. "
        f"Unsupported additions: {len(coverage.unsupported_additions)}."
    )
    out: list[Block] = [paragraph(summary)]
    titles = {row.item_id: row.title for row in coverage.rows}
    if coverage.uncovered_ids:
        out += [
            heading("Uncovered requirements", 3),
            table(
                ["Requirement ID", "Title", "Must or high"],
                [
                    [
                        req_id,
                        titles.get(req_id, NONE),
                        "yes" if req_id in coverage.high_priority_uncovered_ids else "no",
                    ]
                    for req_id in coverage.uncovered_ids
                ],
            ),
        ]
    if coverage.unsupported_additions:
        out += [
            heading("Unsupported scope additions", 3),
            table(
                ["Element", "Kind", "Artifact", "Referenced IDs", "Reason"],
                [
                    [
                        a.element_id,
                        a.element_kind,
                        humanise(a.artifact),
                        join(a.referenced_ids),
                        a.reason,
                    ]
                    for a in coverage.unsupported_additions
                ],
            ),
        ]
    if coverage.rows:
        out += [heading("Coverage matrix", 3), _coverage_matrix(coverage)]
    return out


def _coverage_matrix(coverage: CoverageReport) -> Block:
    """Every scope item against every output column, so nothing is hidden."""
    columns = list(CoverageColumn)
    headers = ["ID", "Type", "Priority", "Status", "In percentage", "Covered"]
    headers += [humanise(column) for column in columns]
    rows = []
    for row in coverage.rows:
        by_column = {cell.column: cell for cell in row.cells}
        rows.append(
            [
                row.item_id,
                row.item_type.value,
                humanise(row.priority),
                humanise(row.status),
                "yes" if row.counts_in_percentage else "no",
                "yes" if row.covered else "no",
                *[
                    join(by_column[column].element_ids) if column in by_column else NONE
                    for column in columns
                ],
            ]
        )
    return table(headers, rows)


def traceability(ctx: Ctx) -> list[Block]:
    if not ctx.items:
        return [missing("No scope items to trace.")]
    elements: dict[str, list[str]] = {}
    if ctx.coverage is not None:
        for row in ctx.coverage.rows:
            elements[row.item_id] = sorted(
                {element for cell in row.cells for element in cell.element_ids}
            )
    rows = [
        [
            item.id,
            item.type.value,
            humanise(item.origin),
            join(elements.get(item.id, [])),
            quote(item),
        ]
        for item in ctx.items
    ]
    blocks: list[Block] = [table(["ID", "Type", "Origin", "Appears in", "Source reference"], rows)]
    if ctx.coverage is None:
        blocks.insert(0, missing("Artifact links are not available; source references are shown."))
    return blocks


def quality_gate(ctx: Ctx) -> list[Block]:
    report = ctx.quality
    out: list[Block] = []
    if report is None:
        out.append(missing("The quality gate has not been run."))
    else:
        summary = report.summary
        out += [
            table(
                ["Measure", "Value"],
                [
                    ["Requirement coverage", f"{summary.coverage_pct:.0f}%"],
                    ["Uncovered requirements", str(summary.uncovered_requirements)],
                    ["Unresolved questions", str(summary.unresolved_questions)],
                    ["Unsupported recommendations", str(summary.unsupported_recommendations)],
                    ["Estimate confidence", humanise(summary.estimate_confidence)],
                    ["Export status", humanise(summary.export_status)],
                ],
            ),
            heading("Checks", 3),
            table(
                ["ID", "Check", "Severity", "Status", "Finding", "Affected IDs", "Remediation"],
                [
                    [
                        c.id.value,
                        c.name,
                        humanise(c.severity),
                        humanise(c.status),
                        text(c.message),
                        join(c.affected_ids),
                        text(c.remediation),
                    ]
                    for c in report.checks
                ],
            ),
        ]
    out += _pre_export_lists(ctx)
    return out


def _pre_export_lists(ctx: Ctx) -> list[Block]:
    """The six lists the spec requires before export."""
    out: list[Block] = [heading("Uncovered requirements", 3)]
    uncovered = list(ctx.coverage.uncovered_ids) if ctx.coverage else []
    out.append(bullets(uncovered) if uncovered else paragraph("None."))

    out.append(heading("Unresolved questions", 3))
    unresolved = [
        f"{item.id}: {text(item.description or item.title)}"
        for item in ctx.of_type(ItemType.CLARIFICATION_QUESTION)
        if item.details.question is None or item.details.question.answer_status is AnswerStatus.OPEN
    ]
    out.append(bullets(unresolved) if unresolved else paragraph("None."))

    out.append(heading("Unsupported recommendations", 3))
    unsupported = (
        [
            f"{a.element_id} ({a.element_kind} in {humanise(a.artifact)}): {a.reason}"
            for a in ctx.coverage.unsupported_additions
        ]
        if ctx.coverage
        else []
    )
    out.append(bullets(unsupported) if unsupported else paragraph("None."))

    out.append(heading("Estimation gaps", 3))
    gaps: list[str] = []
    if ctx.estimate is None:
        gaps.append("The estimate has not been calculated.")
    else:
        gaps += [
            f"{humanise(m.key)}: {m.impact} (affects {join(m.affected_components)})"
            for m in ctx.estimate.missing_inputs
        ]
        gaps += [f"{b.label}: {b.reason}" for b in ctx.estimate.blocked_lines]
    if ctx.quality is not None:
        gaps += [
            f"{c.id.value}: {c.message}"
            for c in ctx.quality.checks
            if c.id is CheckId.QG_07 and c.status is not CheckStatus.PASSED
        ]
    out.append(bullets(gaps) if gaps else paragraph("None."))

    out.append(heading("Inconsistencies", 3))
    inconsistencies = (
        [
            f"{c.id.value} {c.name}: {c.message}"
            for c in ctx.quality.checks
            if c.id in _INCONSISTENCY_CHECKS and c.status is not CheckStatus.PASSED
        ]
        if ctx.quality
        else []
    )
    out.append(bullets(inconsistencies) if inconsistencies else paragraph("None."))

    out.append(heading("Items requiring human validation", 3))
    rows: list[list[str]] = []
    for name, model in artifact_models(ctx.artifacts):
        for element in iter_elements(model):
            if element.validation_required:
                rows.append(
                    [
                        name,
                        element_label(element),
                        join(element.req_ids),
                        basis_title(element.basis),
                        text(element.validation_reason),
                    ]
                )
    for item in ctx.of_type(ItemType.ASSUMPTION):
        details = item.details.assumption
        if details is not None and details.requires_confirmation:
            rows.append(
                [
                    "Scope model",
                    f"{item.id} {item.title}",
                    item.id,
                    humanise(item.origin),
                    f"Confirmation {humanise(details.confirmation_status)}",
                ]
            )
    if rows:
        out.append(table(["Source", "Element", "Requirement IDs", "Basis", "Why"], rows))
    else:
        out.append(paragraph("None."))
    return out
