"""Coverage checks: QG_01, QG_02, QG_03, QG_14, QG_15, QG_16."""

from app.domain.artifacts import ArtifactKind
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import ItemType
from app.quality.checks.common import (
    QualityContext,
    approved_items,
    check_result,
    has_artifact,
    not_applicable,
    referenced_by,
)
from app.traceability.coverage import APPROVED_STATUSES, supporting_ids
from app.traceability.index import iter_elements, string_list


def qg_01_high_priority_coverage(ctx: QualityContext) -> QualityCheckResult:
    name = "High-priority requirement coverage"
    if ctx.coverage.high_priority_count == 0:
        return not_applicable(CheckId.QG_01, name, Severity.ERROR, "No must or high requirements.")
    uncovered = ctx.coverage.high_priority_uncovered_ids
    return check_result(
        CheckId.QG_01,
        name,
        Severity.ERROR,
        [", ".join(uncovered)] if uncovered else [],
        uncovered,
        f"All {ctx.coverage.high_priority_count} must/high requirements are covered "
        "by a capability.",
        "These must or high requirements are not covered by any capability:",
        "Add or extend a capability so each of these requirements is delivered.",
        CheckStatus.FAILED,
    )


def qg_02_uncovered_requirements(ctx: QualityContext) -> QualityCheckResult:
    name = "Uncovered requirements"
    if ctx.coverage.counted_count == 0:
        return not_applicable(
            CheckId.QG_02, name, Severity.WARNING, "No approved requirements to cover yet."
        )
    uncovered = ctx.coverage.uncovered_ids
    return check_result(
        CheckId.QG_02,
        name,
        Severity.WARNING,
        [", ".join(uncovered)] if uncovered else [],
        uncovered,
        f"Requirement coverage is {ctx.coverage.coverage_pct}%.",
        "These approved requirements are not covered by any capability:",
        "Cover them with a capability or mark them out of scope with a reason.",
        CheckStatus.WARNING,
    )


def qg_03_unsupported_additions(ctx: QualityContext) -> QualityCheckResult:
    name = "Unsupported scope additions"
    additions = ctx.coverage.unsupported_additions
    findings = [
        f"{addition.element_kind} {addition.element_id} {addition.reason}."
        for addition in additions
    ]
    return check_result(
        CheckId.QG_03,
        name,
        Severity.WARNING,
        findings,
        [addition.element_id for addition in additions],
        "Every generated element is grounded in an approved requirement.",
        "These elements are not grounded in an approved requirement:",
        "Link each element to a requirement, or accept it as a labelled recommendation.",
        CheckStatus.WARNING,
    )


def qg_14_ai_requirement_coverage(ctx: QualityContext) -> QualityCheckResult:
    name = "AI requirement coverage"
    ai_items = [
        item for item in ctx.items if "ai" in item.tags and item.status in APPROVED_STATUSES
    ]
    if not ai_items and not has_artifact(ctx, ArtifactKind.AI_STRATEGY):
        return not_applicable(
            CheckId.QG_14, name, Severity.WARNING, "This solution has no AI scope."
        )
    handled: set[str] = set()
    for path in ("use_cases", "deterministic_areas", "mandatory_human_decisions"):
        handled |= referenced_by(ctx, ArtifactKind.AI_STRATEGY, path, "req_ids")
    unhandled = [item.id for item in ai_items if item.id not in handled]
    supported = supporting_ids(ctx.items)
    ungrounded = [
        element_id
        for element_id, element in iter_elements(
            ctx.contents, ArtifactKind.AI_STRATEGY, "use_cases"
        )
        if not set(string_list(element.get("req_ids"))) & supported
    ]
    findings: list[str] = []
    if unhandled:
        findings.append(f"AI requirements with no use case or decision: {', '.join(unhandled)}.")
    if ungrounded:
        findings.append(f"AI use cases with no approved requirement: {', '.join(ungrounded)}.")
    return check_result(
        CheckId.QG_14,
        name,
        Severity.WARNING,
        findings,
        unhandled + ungrounded,
        "Every AI requirement is answered by a use case, a deterministic area or a human decision.",
        "The AI strategy and the AI requirements do not line up:",
        "Add a use case, a deterministic area or a human decision for each AI requirement.",
        CheckStatus.WARNING,
    )


def qg_15_requirement_to_estimate(ctx: QualityContext) -> QualityCheckResult:
    name = "Requirement to estimate coverage"
    if not has_artifact(ctx, ArtifactKind.ESTIMATE_DRIVERS):
        return not_applicable(
            CheckId.QG_15, name, Severity.WARNING, "No delivery workstreams have been generated."
        )
    in_workstreams = referenced_by(ctx, ArtifactKind.ESTIMATE_DRIVERS, "workstreams", "req_ids")
    wanted = {
        item.id
        for item in approved_items(
            ctx,
            [ItemType.FUNCTIONAL_REQUIREMENT, ItemType.INTEGRATION, ItemType.DATA_REQUIREMENT],
        )
    }
    wanted |= {
        item.id for item in ctx.items if "ai" in item.tags and item.status in APPROVED_STATUSES
    }
    missing = sorted(item_id for item_id in wanted if item_id not in in_workstreams)
    return check_result(
        CheckId.QG_15,
        name,
        Severity.WARNING,
        [", ".join(missing)] if missing else [],
        missing,
        "Every approved requirement is carried by a delivery workstream.",
        "These approved requirements are in no workstream, so they carry no effort:",
        "Assign the requirement to a workstream or mark it out of scope.",
        CheckStatus.WARNING,
    )


def qg_16_requirement_to_architecture(ctx: QualityContext) -> QualityCheckResult:
    name = "Requirement to architecture coverage"
    if not has_artifact(ctx, ArtifactKind.ARCHITECTURE):
        return not_applicable(
            CheckId.QG_16, name, Severity.WARNING, "No architecture has been generated."
        )
    supported = referenced_by(ctx, ArtifactKind.ARCHITECTURE, "components", "supported_ids")
    wanted = approved_items(
        ctx,
        [
            ItemType.FUNCTIONAL_REQUIREMENT,
            ItemType.NON_FUNCTIONAL_REQUIREMENT,
            ItemType.DATA_REQUIREMENT,
            ItemType.SECURITY_COMPLIANCE,
            ItemType.INTEGRATION,
        ],
    )
    missing = [item.id for item in wanted if item.id not in supported]
    return check_result(
        CheckId.QG_16,
        name,
        Severity.WARNING,
        [", ".join(missing)] if missing else [],
        missing,
        "Every approved requirement is supported by an architecture component.",
        "No architecture component supports these approved requirements:",
        "Add or extend a component, or record why the requirement needs none.",
        CheckStatus.WARNING,
    )
