"""Round-trips for the estimation, quality, change and package contracts."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.domain.artifacts import ArtifactKind, Complexity, UnitType
from app.domain.changes import ChangeRecord, ChangeRequest, ChangeType, ChangeValue, ImpactEntry
from app.domain.estimation import (
    BaseEffortEntry,
    ConfidenceLevel,
    ConfidenceSpread,
    Estimate,
    EstimationConfig,
    EstimationRules,
    FactorEntry,
    FactorKind,
    Milestone,
    MissingInput,
    PhaseEstimate,
    RateCard,
    RoleRate,
    RomRange,
    RoundingRule,
    TraceEntry,
    TraceInput,
    WorkstreamEstimate,
)
from app.domain.package import DISCLAIMER, Block, BlockType, DocumentModel, Section
from app.domain.quality import (
    CheckId,
    CheckStatus,
    ExportStatus,
    QualityCheckResult,
    QualityReport,
    QualitySummary,
    Severity,
)
from app.domain.scope import SessionConfig

SPEC_DISCLAIMER = (
    "This document is an AI-assisted internal planning output based on customer requirements and "
    "stated assumptions. It requires review and validation by qualified sales, architecture, "
    "delivery, security, and commercial stakeholders. It is not a final quote, contractual "
    "commitment, or delivery guarantee."
)


def test_disclaimer_matches_the_spec_statement_exactly() -> None:
    assert DISCLAIMER == SPEC_DISCLAIMER


def test_document_model_round_trip_keeps_the_disclaimer() -> None:
    document = DocumentModel(
        title="Solution Scoping Package",
        subtitle="Acme",
        generated_at=datetime(2026, 9, 17),
        sections=[
            Section(
                id="executive_summary",
                title="Executive Summary",
                blocks=[
                    Block(type=BlockType.HEADING, text="Executive Summary", level=1),
                    Block(type=BlockType.PARAGRAPH, text="A modernized portal."),
                    Block(type=BlockType.BULLET_LIST, items=["Faster onboarding"]),
                    Block(
                        type=BlockType.TABLE,
                        headers=["Workstream", "Effort"],
                        rows=[["Experience", "18-24"]],
                    ),
                    Block(type=BlockType.IMAGE, image_ref="architecture.png", text="Architecture"),
                    Block(type=BlockType.CODE, text="graph TD;", language="mermaid"),
                ],
            )
        ],
    )
    restored = DocumentModel.model_validate(document.model_dump())
    assert restored == document
    assert restored.disclaimer == SPEC_DISCLAIMER


def test_estimation_config_round_trip() -> None:
    config = EstimationConfig(
        session_config=SessionConfig(rate_card_id="usd-default"),
        rate_card=RateCard(
            id="usd-default",
            name="USD standard",
            currency="USD",
            rates=[RoleRate(role="Backend Engineer", rate_per_person_week=6000)],
        ),
        rules=EstimationRules(
            base_effort=[
                BaseEffortEntry(
                    unit_type=UnitType.CAPABILITY, complexity=Complexity.HIGH, person_weeks=6
                )
            ],
            factors=[
                FactorEntry(factor=FactorKind.SECURITY_LEVEL, value="regulated", multiplier=1.25)
            ],
            spreads=[ConfidenceSpread(confidence=ConfidenceLevel.MEDIUM, spread_pct=0.2)],
            rounding=[RoundingRule(confidence=ConfidenceLevel.MEDIUM, nearest=5000)],
        ),
    )
    assert EstimationConfig.model_validate(config.model_dump()) == config


def test_estimate_round_trip() -> None:
    estimate = Estimate(
        workstreams=[
            WorkstreamEstimate(
                workstream_id="WS_01",
                name="Data and Integration",
                req_ids=["DATA_01", "INT_01"],
                roles=["Data Engineer"],
                complexity=Complexity.HIGH,
                effort_low=18,
                effort_high=24,
                confidence=ConfidenceLevel.MEDIUM,
                limitations=["External API readiness has not been confirmed."],
                trace=[
                    TraceEntry(
                        label="Unit effort",
                        formula="base x factors",
                        inputs=[TraceInput(name="base", value="6")],
                        result=7.5,
                    )
                ],
            )
        ],
        phases=[
            PhaseEstimate(
                name="Phase 3",
                workstream_ids=["WS_01"],
                weeks_low=6,
                weeks_high=9,
                milestones=[
                    Milestone(name="Integrations live", phase="Phase 3", week_low=6, week_high=9)
                ],
            )
        ],
        effort_low=18,
        effort_high=24,
        effort_incl_contingency_low=20.7,
        effort_incl_contingency_high=27.6,
        timeline_weeks_low=6,
        timeline_weeks_high=9,
        rom=RomRange(
            amount_low=125000,
            amount_high=165000,
            currency="USD",
            rate_basis="role_mix",
            contingency_pct=0.15,
        ),
        overall_confidence=ConfidenceLevel.MEDIUM,
        missing_inputs=[
            MissingInput(
                key="expected_users",
                impact="Infrastructure sizing is assumed.",
                affected_components=["WS_01"],
            )
        ],
        rate_card_id="usd-default",
        config_hash="abc123",
        calculated_at=datetime(2026, 9, 17),
    )
    assert Estimate.model_validate(estimate.model_dump()) == estimate


def test_quality_report_round_trip() -> None:
    report = QualityReport(
        session_id="s1",
        scope_version=3,
        checks=[
            QualityCheckResult(
                id=CheckId.QG_02,
                name="Uncovered requirements",
                severity=Severity.WARNING,
                status=CheckStatus.FAILED,
                message="2 requirements are not covered by any capability.",
                affected_ids=["FR_07", "NFR_02"],
                remediation="Add a capability or mark the requirements out of scope.",
            )
        ],
        summary=QualitySummary(
            coverage_pct=92,
            uncovered_requirements=2,
            unresolved_questions=4,
            unsupported_recommendations=1,
            estimate_confidence=ConfidenceLevel.MEDIUM,
            export_status=ExportStatus.REVIEW_REQUIRED,
        ),
        created_at=datetime(2026, 9, 17),
    )
    assert QualityReport.model_validate(report.model_dump()) == report
    assert len(list(CheckId)) == 16


def test_quality_summary_rejects_impossible_coverage() -> None:
    with pytest.raises(ValidationError):
        QualitySummary(
            coverage_pct=120,
            uncovered_requirements=0,
            unresolved_questions=0,
            unsupported_recommendations=0,
            estimate_confidence=ConfidenceLevel.HIGH,
            export_status=ExportStatus.READY,
        )


def test_change_record_round_trip() -> None:
    record = ChangeRecord(
        id="c1",
        session_id="s1",
        scope_version=4,
        request=ChangeRequest(
            change_type=ChangeType.CONFIG_CHANGE,
            description="Expected users increased from 5,000 to 500,000.",
            values=[ChangeValue(key="expected_users", old_value="5000", new_value="500000")],
        ),
        affected=[
            ImpactEntry(
                artifact=ArtifactKind.ARCHITECTURE,
                element_ids=["ARC_01"],
                reason="Scalability components depend on user volume.",
            )
        ],
        unaffected_summary=["Customer personas", "Core onboarding workflow"],
        suggested_actions=["Regenerate the architecture", "Recalculate the estimate"],
        created_at=datetime(2026, 9, 17),
    )
    assert ChangeRecord.model_validate(record.model_dump()) == record
