"""QG_13: the nine pairwise document checks."""

from collections.abc import Callable
from dataclasses import dataclass

from app.domain.artifacts import ArchitectureArea, ArtifactKind, Basis, ProcessingClass
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import ItemType
from app.quality.checks.common import (
    QualityContext,
    approved_items,
    check_result,
    element_ids,
    has_artifact,
    referenced_by,
)
from app.traceability.coverage import is_scope_id, supporting_ids
from app.traceability.index import iter_elements, string_list


@dataclass(frozen=True)
class PairFinding:
    """One contradiction between two documents."""

    pair: str
    message: str
    ids: tuple[str, ...]
    hard: bool


def _pair_scope_prd(ctx: QualityContext) -> list[PairFinding]:
    pair = "Scope ↔ PRD"
    if not has_artifact(ctx, ArtifactKind.PRD):
        return []
    supported = supporting_ids(ctx.items)
    cited = {
        ref.target_id
        for ref in ctx.index.refs
        if ref.artifact is ArtifactKind.PRD and is_scope_id(ref.target_id)
    }
    dangling = sorted(ref for ref in cited if ref not in supported)
    findings = []
    if dangling:
        findings.append(
            PairFinding(
                pair,
                f"the PRD cites ids that are not approved: {', '.join(dangling)}",
                tuple(dangling),
                hard=True,
            )
        )
    missing = sorted(
        item.id
        for item in approved_items(
            ctx, [ItemType.FUNCTIONAL_REQUIREMENT, ItemType.NON_FUNCTIONAL_REQUIREMENT]
        )
        if item.id not in cited
    )
    if missing:
        findings.append(
            PairFinding(
                pair,
                f"requirements missing from the PRD: {', '.join(missing)}",
                tuple(missing),
                hard=False,
            )
        )
    return findings


def _pair_scope_functional(ctx: QualityContext) -> list[PairFinding]:
    pair = "Scope ↔ Functional scope"
    if not has_artifact(ctx, ArtifactKind.FUNCTIONAL_SCOPE):
        return []
    supported = supporting_ids(ctx.items)
    included = referenced_by(ctx, ArtifactKind.FUNCTIONAL_SCOPE, "capabilities", "included_req_ids")
    dangling = sorted(ref for ref in included if ref not in supported)
    if not dangling:
        return []
    return [
        PairFinding(
            pair,
            f"capabilities include ids that are not approved: {', '.join(dangling)}",
            tuple(dangling),
            hard=True,
        )
    ]


def _pair_functional_architecture(ctx: QualityContext) -> list[PairFinding]:
    pair = "Functional scope ↔ Architecture"
    if not (
        has_artifact(ctx, ArtifactKind.FUNCTIONAL_SCOPE)
        and has_artifact(ctx, ArtifactKind.ARCHITECTURE)
    ):
        return []
    supported = referenced_by(ctx, ArtifactKind.ARCHITECTURE, "components", "supported_ids")
    unsupported: list[str] = []
    for element_id, element in iter_elements(
        ctx.contents, ArtifactKind.FUNCTIONAL_SCOPE, "capabilities"
    ):
        if not set(string_list(element.get("included_req_ids"))) & supported:
            unsupported.append(element_id)
    if not unsupported:
        return []
    return [
        PairFinding(
            pair,
            f"no architecture component supports: {', '.join(unsupported)}",
            tuple(unsupported),
            hard=False,
        )
    ]


def _dangling_arc(ctx: QualityContext, kind: ArtifactKind, pair: str) -> list[PairFinding]:
    if not (has_artifact(ctx, kind) and has_artifact(ctx, ArtifactKind.ARCHITECTURE)):
        return []
    components = set(element_ids(ctx, ArtifactKind.ARCHITECTURE, "components"))
    dangling = sorted(
        ref.target_id
        for ref in ctx.index.refs
        if ref.artifact is kind and ref.field == "arc_ids" and ref.target_id not in components
    )
    if not dangling:
        return []
    return [
        PairFinding(
            pair,
            f"references components that do not exist: {', '.join(dict.fromkeys(dangling))}",
            tuple(dict.fromkeys(dangling)),
            hard=True,
        )
    ]


def _pair_architecture_data(ctx: QualityContext) -> list[PairFinding]:
    return _dangling_arc(ctx, ArtifactKind.DATA_STRATEGY, "Architecture ↔ Data strategy")


def _pair_architecture_integration(ctx: QualityContext) -> list[PairFinding]:
    return _dangling_arc(
        ctx, ArtifactKind.INTEGRATION_ARCHITECTURE, "Architecture ↔ Integration architecture"
    )


def _pair_architecture_ai(ctx: QualityContext) -> list[PairFinding]:
    pair = "Architecture ↔ AI strategy"
    if not (
        has_artifact(ctx, ArtifactKind.AI_STRATEGY) and has_artifact(ctx, ArtifactKind.ARCHITECTURE)
    ):
        return []
    has_ai_component = any(
        element.get("area") == ArchitectureArea.AI_AND_ML_SERVICES.value
        for _element_id, element in iter_elements(
            ctx.contents, ArtifactKind.ARCHITECTURE, "components"
        )
    )
    if has_ai_component:
        return []
    grounded: list[str] = []
    recommended: list[str] = []
    for element_id, element in iter_elements(ctx.contents, ArtifactKind.AI_STRATEGY, "use_cases"):
        if element.get("processing_class") != ProcessingClass.AI.value:
            continue
        if element.get("basis") == Basis.RECOMMENDED.value:
            recommended.append(element_id)
        else:
            grounded.append(element_id)
    findings: list[PairFinding] = []
    if grounded:
        findings.append(
            PairFinding(
                pair,
                "AI use cases exist but the architecture has no AI or ML component",
                tuple(grounded),
                hard=True,
            )
        )
    if recommended:
        # The architecture is designed before the AI strategy, so a use case the AI
        # recommends on its own is not a contradiction yet; it is a decision to make.
        findings.append(
            PairFinding(
                pair,
                "recommended AI use cases are not reflected in the architecture; accept them "
                "and regenerate the architecture, or reject them",
                tuple(recommended),
                hard=False,
            )
        )
    return findings


def _pair_membership(
    ctx: QualityContext, pair: str, kind: ArtifactKind, path: str, field: str, label: str
) -> list[PairFinding]:
    """Ids of one artifact must appear in the delivery workstreams, and vice versa."""
    if not (has_artifact(ctx, kind) and has_artifact(ctx, ArtifactKind.ESTIMATE_DRIVERS)):
        return []
    known = set(element_ids(ctx, kind, path))
    planned = referenced_by(ctx, ArtifactKind.ESTIMATE_DRIVERS, "workstreams", field)
    findings: list[PairFinding] = []
    unknown = sorted(planned - known)
    if unknown:
        findings.append(
            PairFinding(
                pair,
                f"workstreams reference unknown {label}: {', '.join(unknown)}",
                tuple(unknown),
                hard=True,
            )
        )
    unplanned = sorted(known - planned)
    if unplanned:
        findings.append(
            PairFinding(
                pair,
                f"{label} not in any workstream: {', '.join(unplanned)}",
                tuple(unplanned),
                hard=False,
            )
        )
    return findings


def _pair_functional_estimate(ctx: QualityContext) -> list[PairFinding]:
    return _pair_membership(
        ctx,
        "Functional scope ↔ Estimate",
        ArtifactKind.FUNCTIONAL_SCOPE,
        "capabilities",
        "capability_ids",
        "capabilities",
    )


def _pair_integration_estimate(ctx: QualityContext) -> list[PairFinding]:
    return _pair_membership(
        ctx,
        "Integration ↔ Estimate",
        ArtifactKind.INTEGRATION_ARCHITECTURE,
        "integrations",
        "integration_ids",
        "integrations",
    )


def _pair_ai_estimate(ctx: QualityContext) -> list[PairFinding]:
    return _pair_membership(
        ctx,
        "AI use cases ↔ Estimate",
        ArtifactKind.AI_STRATEGY,
        "use_cases",
        "ai_use_case_ids",
        "AI use cases",
    )


PAIR_CHECKS: tuple[Callable[[QualityContext], list[PairFinding]], ...] = (
    _pair_scope_prd,
    _pair_scope_functional,
    _pair_functional_architecture,
    _pair_architecture_data,
    _pair_architecture_integration,
    _pair_architecture_ai,
    _pair_functional_estimate,
    _pair_integration_estimate,
    _pair_ai_estimate,
)


def pairwise_findings(ctx: QualityContext) -> list[PairFinding]:
    return [finding for check in PAIR_CHECKS for finding in check(ctx)]


def qg_13_cross_document_consistency(ctx: QualityContext) -> QualityCheckResult:
    name = "Cross-document consistency"
    findings = pairwise_findings(ctx)
    status = (
        CheckStatus.FAILED if any(finding.hard for finding in findings) else CheckStatus.WARNING
    )
    return check_result(
        CheckId.QG_13,
        name,
        Severity.ERROR,
        [f"{finding.pair}: {finding.message}." for finding in findings],
        [item_id for finding in findings for item_id in finding.ids],
        "The documents agree: every cross-reference resolves and nothing is orphaned.",
        "The documents contradict each other:",
        "Regenerate the affected document, or correct the reference it cites.",
        status,
    )
