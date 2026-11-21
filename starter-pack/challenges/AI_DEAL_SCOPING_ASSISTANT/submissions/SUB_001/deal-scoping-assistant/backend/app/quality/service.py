"""Runs the 16 checks and produces the pre-export quality report (PLAN section 8)."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from app.domain.artifacts import ArtifactKind, ArtifactStatus
from app.domain.estimation import ConfidenceLevel, Estimate, RateCard
from app.domain.quality import (
    CheckStatus,
    ExportStatus,
    QualityCheckResult,
    QualityReport,
    QualitySummary,
    ValidationItem,
)
from app.domain.scope import (
    AnswerStatus,
    CloudPlatform,
    ItemStatus,
    ItemType,
    ScopeItem,
    SessionConfig,
)
from app.quality.checks import (
    ALL_CHECKS,
    QualityContext,
    pending_assumption_ids,
    validation_required_elements,
)
from app.traceability.coverage import CoverageReport, build_coverage
from app.traceability.index import build_index

# Artifacts the scoping package cannot be assembled without.
REQUIRED_ARTIFACT_KINDS: tuple[ArtifactKind, ...] = (
    ArtifactKind.PRD,
    ArtifactKind.FUNCTIONAL_SCOPE,
    ArtifactKind.ARCHITECTURE,
    ArtifactKind.DATA_STRATEGY,
    ArtifactKind.INTEGRATION_ARCHITECTURE,
    ArtifactKind.AI_STRATEGY,
    ArtifactKind.ESTIMATE_DRIVERS,
    ArtifactKind.ESTIMATE,
    ArtifactKind.EXECUTIVE_SUMMARY,
)

_OPEN_STATUS = (CheckStatus.WARNING, CheckStatus.FAILED)


def build_context(
    session_id: str,
    scope_version: int,
    items: Sequence[ScopeItem],
    contents: Mapping[ArtifactKind, Mapping[str, Any]],
    config: SessionConfig,
    statuses: Mapping[ArtifactKind, ArtifactStatus] | None = None,
    estimate: Estimate | None = None,
    cloud_platform: CloudPlatform | None = None,
    catalog_services: Mapping[str, frozenset[str]] | None = None,
    rate_card: RateCard | None = None,
    expected_config_hash: str = "",
    required_kinds: Sequence[ArtifactKind] = REQUIRED_ARTIFACT_KINDS,
    coverage: CoverageReport | None = None,
) -> QualityContext:
    """Assemble the read-only view the checks work on."""
    index = build_index(contents)
    return QualityContext(
        session_id=session_id,
        scope_version=scope_version,
        items=tuple(items),
        contents=contents,
        statuses=statuses or {},
        index=index,
        coverage=coverage if coverage is not None else build_coverage(items, contents, index),
        config=config,
        required_kinds=tuple(required_kinds),
        estimate=estimate,
        cloud_platform=cloud_platform,
        catalog_services=catalog_services,
        rate_card=rate_card,
        expected_config_hash=expected_config_hash,
    )


def _open_questions(items: Sequence[ScopeItem]) -> int:
    return sum(
        1
        for item in items
        if item.type is ItemType.CLARIFICATION_QUESTION
        and item.status is not ItemStatus.REJECTED
        and item.details.question is not None
        and item.details.question.answer_status is AnswerStatus.OPEN
    )


def export_status(
    ctx: QualityContext, checks: Sequence[QualityCheckResult], has_stale: bool
) -> ExportStatus:
    """Blocked only when a required artifact is missing; stale gives review_required."""
    missing = [kind for kind in ctx.required_kinds if kind not in ctx.contents]
    if missing:
        return ExportStatus.BLOCKED
    if has_stale or any(check.status in _OPEN_STATUS for check in checks):
        return ExportStatus.REVIEW_REQUIRED
    return ExportStatus.READY


def items_requiring_human_validation(ctx: QualityContext) -> list[ValidationItem]:
    """Pending assumptions the artifacts rely on, plus elements flagged for validation."""
    validation_items = [
        ValidationItem(
            id=item_id,
            kind="assumption",
            artifact=None,
            reason="Assumption is not confirmed but generated content relies on it.",
        )
        for item_id in pending_assumption_ids(ctx)
    ]
    validation_items.extend(
        ValidationItem(
            id=element_id,
            kind="element",
            artifact=kind,
            reason=reason or "Element is a recommendation or rests on an assumption.",
        )
        for kind, element_id, reason in validation_required_elements(ctx)
    )
    return validation_items


def run_quality_gate(ctx: QualityContext, created_at: datetime) -> QualityReport:
    """Run every check and summarise what the reviewer must know before export."""
    checks = [check(ctx) for check in ALL_CHECKS]
    has_stale = any(
        status is ArtifactStatus.STALE and kind in ctx.contents
        for kind, status in ctx.statuses.items()
    )
    confidence = ctx.estimate.overall_confidence if ctx.estimate else ConfidenceLevel.LOW
    summary = QualitySummary(
        coverage_pct=ctx.coverage.coverage_pct,
        uncovered_requirements=len(ctx.coverage.uncovered_ids),
        unresolved_questions=_open_questions(ctx.items),
        unsupported_recommendations=len(ctx.coverage.unsupported_additions),
        estimate_confidence=confidence,
        export_status=export_status(ctx, checks, has_stale),
    )
    return QualityReport(
        session_id=ctx.session_id,
        scope_version=ctx.scope_version,
        checks=checks,
        summary=summary,
        items_requiring_human_validation=items_requiring_human_validation(ctx),
        created_at=created_at,
    )
