"""Delivery and commercial checks: QG_05, QG_07 and QG_10."""

from collections.abc import Iterable
from decimal import Decimal

from app.domain.artifacts import ArtifactKind
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import ItemType
from app.estimation.lines import round_effort
from app.quality.checks.common import (
    QualityContext,
    approved_items,
    check_result,
    element_ids,
    has_artifact,
    not_applicable,
    referenced_by,
)


def qg_05_integrations_in_delivery_plan(ctx: QualityContext) -> QualityCheckResult:
    name = "Integrations missing from the delivery plan"
    approved_int = approved_items(ctx, [ItemType.INTEGRATION])
    if not has_artifact(ctx, ArtifactKind.INTEGRATION_ARCHITECTURE) and not approved_int:
        return not_applicable(
            CheckId.QG_05, name, Severity.ERROR, "This solution has no integrations."
        )
    planned = referenced_by(ctx, ArtifactKind.ESTIMATE_DRIVERS, "workstreams", "integration_ids")
    integration_ids = element_ids(ctx, ArtifactKind.INTEGRATION_ARCHITECTURE, "integrations")
    unplanned = [ia_id for ia_id in integration_ids if ia_id not in planned]
    designed = referenced_by(ctx, ArtifactKind.INTEGRATION_ARCHITECTURE, "integrations", "req_ids")
    undesigned = [item.id for item in approved_int if item.id not in designed]
    findings: list[str] = []
    if unplanned:
        findings.append(f"not in any workstream: {', '.join(unplanned)}.")
    if undesigned:
        findings.append(f"no integration designed for: {', '.join(undesigned)}.")
    return check_result(
        CheckId.QG_05,
        name,
        Severity.ERROR,
        findings,
        unplanned + undesigned,
        "Every integration is designed and carried by a delivery workstream.",
        "The integration plan and the delivery plan disagree:",
        "Add the integration to a workstream, or design the missing integration.",
        CheckStatus.FAILED,
    )


def qg_07_missing_estimation_inputs(ctx: QualityContext) -> QualityCheckResult:
    name = "Missing estimation inputs"
    if ctx.estimate is None:
        return check_result(
            CheckId.QG_07,
            name,
            Severity.ERROR,
            ["The estimate has not been calculated yet."],
            [],
            "",
            "",
            "Calculate the estimate before export.",
            CheckStatus.WARNING,
        )
    findings = [f"{entry.key}: {entry.impact}" for entry in ctx.estimate.missing_inputs]
    blocked = [f"{line.label} is blocked ({line.reason})." for line in ctx.estimate.blocked_lines]
    status = CheckStatus.FAILED if blocked else CheckStatus.WARNING
    return check_result(
        CheckId.QG_07,
        name,
        Severity.ERROR,
        blocked + findings,
        [entry.key for entry in ctx.estimate.missing_inputs],
        "All estimation inputs are present.",
        "The estimate is missing inputs:",
        "Provide the missing inputs, or export with the gap stated as an assumption.",
        status,
    )


def qg_10_estimate_consistency(ctx: QualityContext) -> QualityCheckResult:
    name = "Estimate and commercial inconsistencies"
    estimate = ctx.estimate
    if estimate is None:
        return not_applicable(
            CheckId.QG_10, name, Severity.ERROR, "The estimate has not been calculated yet."
        )
    findings: list[str] = []
    ids: list[str] = []
    # Same rule as the engine: the total is the sum of the shown lines, in whole person-weeks.
    low = _total_of(line.effort_low for line in estimate.workstreams)
    high = _total_of(line.effort_high for line in estimate.workstreams)
    if low != estimate.effort_low:
        findings.append(f"workstream effort adds up to {low}, total says {estimate.effort_low}.")
    if high != estimate.effort_high:
        findings.append(f"workstream effort adds up to {high}, total says {estimate.effort_high}.")
    if ctx.rate_card is not None:
        if estimate.rom.currency != ctx.rate_card.currency:
            findings.append(
                f"the ROM is in {estimate.rom.currency} but the rate card is "
                f"in {ctx.rate_card.currency}."
            )
        if estimate.rate_card_id != ctx.rate_card.id:
            findings.append("the estimate used a different rate card than the session.")
    known_workstreams = set(element_ids(ctx, ArtifactKind.ESTIMATE_DRIVERS, "workstreams"))
    if known_workstreams:
        unknown = [
            line.workstream_id
            for line in estimate.workstreams
            if not line.overhead and line.workstream_id not in known_workstreams
        ]
        if unknown:
            findings.append(f"unknown workstream ids in the estimate: {', '.join(unknown)}.")
            ids.extend(unknown)
    if ctx.expected_config_hash and estimate.config_hash != ctx.expected_config_hash:
        findings.append("the estimate was calculated with an older configuration.")
    return check_result(
        CheckId.QG_10,
        name,
        Severity.ERROR,
        findings,
        ids,
        "Effort, currency and rate card are consistent.",
        "The estimate does not add up:",
        "Recalculate the estimate against the current configuration.",
        CheckStatus.FAILED,
    )


def _total_of(line_efforts: Iterable[float]) -> float:
    return float(round_effort(sum((Decimal(str(value)) for value in line_efforts), Decimal(0))))
