"""Shared inputs and small helpers for the quality checks."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.domain.artifacts import ArtifactKind, ArtifactStatus
from app.domain.estimation import Estimate, RateCard
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import CloudPlatform, ItemType, ScopeItem, SessionConfig
from app.traceability.coverage import APPROVED_STATUSES, CoverageReport
from app.traceability.index import TraceIndex, iter_elements


@dataclass(frozen=True)
class QualityContext:
    """Everything the checks read; assembled by `app.quality.service`."""

    session_id: str
    scope_version: int
    items: tuple[ScopeItem, ...]
    contents: Mapping[ArtifactKind, Mapping[str, Any]]
    statuses: Mapping[ArtifactKind, ArtifactStatus]
    index: TraceIndex
    coverage: CoverageReport
    config: SessionConfig
    required_kinds: tuple[ArtifactKind, ...]
    estimate: Estimate | None = None
    cloud_platform: CloudPlatform | None = None
    catalog_services: Mapping[str, frozenset[str]] | None = None
    rate_card: RateCard | None = None
    expected_config_hash: str = ""


def approved_items(ctx: QualityContext, types: Sequence[ItemType]) -> list[ScopeItem]:
    return [item for item in ctx.items if item.type in types and item.status in APPROVED_STATUSES]


def has_artifact(ctx: QualityContext, kind: ArtifactKind) -> bool:
    return kind in ctx.contents


def element_ids(ctx: QualityContext, kind: ArtifactKind, path: str) -> list[str]:
    return [element_id for element_id, _ in iter_elements(ctx.contents, kind, path)]


def referenced_by(ctx: QualityContext, kind: ArtifactKind, path: str, field: str) -> set[str]:
    return {
        ref.target_id
        for ref in ctx.index.refs
        if ref.artifact is kind and ref.path == path and ref.field == field
    }


def check_result(
    check_id: CheckId,
    name: str,
    severity: Severity,
    findings: Sequence[str],
    ids: Sequence[str],
    passed_message: str,
    failed_message: str,
    remediation: str,
    status: CheckStatus,
) -> QualityCheckResult:
    if not findings:
        return QualityCheckResult(
            id=check_id,
            name=name,
            severity=severity,
            status=CheckStatus.PASSED,
            message=passed_message,
            affected_ids=[],
            remediation="",
        )
    return QualityCheckResult(
        id=check_id,
        name=name,
        severity=severity,
        status=status,
        message=f"{failed_message} {' '.join(findings)}".strip(),
        affected_ids=list(dict.fromkeys(ids)),
        remediation=remediation,
    )


def not_applicable(
    check_id: CheckId, name: str, severity: Severity, why: str
) -> QualityCheckResult:
    return QualityCheckResult(
        id=check_id, name=name, severity=severity, status=CheckStatus.NOT_APPLICABLE, message=why
    )


def raw_list(ctx: QualityContext, kind: ArtifactKind, path: str) -> list[Mapping[str, Any]]:
    value = ctx.contents.get(kind, {}).get(path)
    if not isinstance(value, list):
        return []
    return [entry for entry in value if isinstance(entry, Mapping)]
