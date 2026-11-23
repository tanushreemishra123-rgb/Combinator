"""Quality-gate models (PLAN section 8). Models only; checks live in `app/quality`."""

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.domain.artifacts import ArtifactKind
from app.domain.base import DomainModel
from app.domain.estimation import ConfidenceLevel


class CheckId(StrEnum):
    QG_01 = "QG_01"
    QG_02 = "QG_02"
    QG_03 = "QG_03"
    QG_04 = "QG_04"
    QG_05 = "QG_05"
    QG_06 = "QG_06"
    QG_07 = "QG_07"
    QG_08 = "QG_08"
    QG_09 = "QG_09"
    QG_10 = "QG_10"
    QG_11 = "QG_11"
    QG_12 = "QG_12"
    QG_13 = "QG_13"
    QG_14 = "QG_14"
    QG_15 = "QG_15"
    QG_16 = "QG_16"


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class CheckStatus(StrEnum):
    PASSED = "passed"
    WARNING = "warning"
    FAILED = "failed"
    NOT_APPLICABLE = "not_applicable"


class ExportStatus(StrEnum):
    READY = "ready"
    REVIEW_REQUIRED = "review_required"
    BLOCKED = "blocked"


class QualityCheckResult(DomainModel):
    id: CheckId = Field(description="Check id from the catalogue, QG_01 to QG_16.")
    name: str = Field(description="Short name of the check.")
    severity: Severity = Field(description="How serious a finding of this check is.")
    status: CheckStatus = Field(description="Outcome of the check.")
    message: str = Field(description="What the check found.")
    affected_ids: list[str] = Field(
        default_factory=list, description="Scope or artifact element ids involved."
    )
    remediation: str = Field(default="", description="What the reviewer should do about it.")


class QualitySummary(DomainModel):
    coverage_pct: float = Field(
        ge=0, le=100, description="Share of FR/NFR/INT/DATA/SEC requirements covered."
    )
    uncovered_requirements: int = Field(ge=0, description="Number of uncovered requirements.")
    unresolved_questions: int = Field(ge=0, description="Number of open clarification questions.")
    unsupported_recommendations: int = Field(
        ge=0, description="Elements referencing no approved requirement."
    )
    estimate_confidence: ConfidenceLevel = Field(description="Overall estimate confidence.")
    export_status: ExportStatus = Field(description="ready, review_required or blocked.")


class ValidationItem(DomainModel):
    """One thing a human must confirm before the package is used."""

    id: str = Field(description="Assumption id or generated element id.")
    kind: str = Field(description="assumption or element.")
    artifact: ArtifactKind | None = Field(
        default=None, description="Artifact the element belongs to, for elements."
    )
    reason: str = Field(description="Why a human has to validate it.")


class QualityReport(DomainModel):
    session_id: str = Field(description="Session the report belongs to.")
    scope_version: int = Field(description="Scope version the report was run against.")
    checks: list[QualityCheckResult] = Field(default_factory=list, description="Check results.")
    summary: QualitySummary = Field(description="Summary shown before export.")
    items_requiring_human_validation: list[ValidationItem] = Field(
        default_factory=list, description="Pending assumptions and elements flagged for review."
    )
    created_at: datetime = Field(description="When the gate was run.")
