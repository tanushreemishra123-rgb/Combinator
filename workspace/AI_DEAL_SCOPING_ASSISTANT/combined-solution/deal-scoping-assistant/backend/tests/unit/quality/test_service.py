"""The quality report: summary, export status and human-validation list."""

from app.domain.artifacts import ArtifactKind, ArtifactStatus
from app.domain.estimation import ConfidenceLevel
from app.domain.quality import CheckId, CheckStatus, ExportStatus
from app.domain.scope import AnswerStatus, CloudPlatform, ConfirmationStatus
from app.quality.service import build_context, run_quality_gate
from tests.unit import _fixtures as fx


def _report(**kwargs):
    return run_quality_gate(fx.quality_context(**kwargs), fx.NOW)


def test_a_clean_session_is_ready_to_export():
    report = _report()
    assert report.summary.export_status is ExportStatus.READY
    assert report.summary.coverage_pct == 100.0
    assert report.summary.uncovered_requirements == 0
    assert report.summary.unresolved_questions == 0
    assert report.summary.unsupported_recommendations == 0
    assert report.summary.estimate_confidence is ConfidenceLevel.MEDIUM
    assert report.session_id == fx.SESSION_ID
    assert report.scope_version == fx.SCOPE_VERSION


def test_a_warning_makes_the_export_review_required():
    contents = fx.artifact_contents()
    contents[ArtifactKind.AI_STRATEGY]["use_cases"][0]["evaluation"] = ""
    report = _report(contents=contents)
    assert report.summary.export_status is ExportStatus.REVIEW_REQUIRED


def test_a_stale_artifact_is_review_required_not_blocked():
    statuses = fx.artifact_statuses()
    statuses[ArtifactKind.ARCHITECTURE] = ArtifactStatus.STALE
    report = _report(statuses=statuses)
    assert report.summary.export_status is ExportStatus.REVIEW_REQUIRED
    stale_check = next(check for check in report.checks if check.id is CheckId.QG_12)
    assert stale_check.status is CheckStatus.WARNING


def test_a_missing_required_artifact_blocks_the_export():
    contents = fx.artifact_contents()
    contents.pop(ArtifactKind.EXECUTIVE_SUMMARY)
    report = _report(contents=contents)
    assert report.summary.export_status is ExportStatus.BLOCKED


def test_without_an_estimate_the_confidence_is_reported_as_low():
    context = build_context(
        session_id=fx.SESSION_ID,
        scope_version=fx.SCOPE_VERSION,
        items=fx.scope_items(),
        contents=fx.artifact_contents(),
        config=fx.session_config(),
        statuses=fx.artifact_statuses(),
        cloud_platform=CloudPlatform.AZURE,
        catalog_services=fx.catalog_services(),
    )
    report = run_quality_gate(context, fx.NOW)
    assert report.summary.estimate_confidence is ConfidenceLevel.LOW
    assert report.summary.export_status is ExportStatus.REVIEW_REQUIRED


def test_open_questions_and_uncovered_requirements_reach_the_summary():
    contents = fx.artifact_contents()
    capability = contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][1]
    capability["included_req_ids"] = ["FR_02"]
    capability["req_ids"] = ["FR_02"]
    items = fx.scope_items()
    question = next(item for item in items if item.id == "Q_01")
    assert question.details.question is not None
    question.details.question.answer_status = AnswerStatus.OPEN
    report = _report(items=items, contents=contents)
    assert report.summary.uncovered_requirements == 1
    assert report.summary.unresolved_questions == 1
    assert report.summary.coverage_pct == 87.5


def test_pending_assumptions_and_flagged_elements_need_human_validation():
    items = fx.scope_items()
    assumption = next(item for item in items if item.id == "ASM_01")
    assert assumption.details.assumption is not None
    assumption.details.assumption.confirmation_status = ConfirmationStatus.PENDING
    contents = fx.artifact_contents()
    component = contents[ArtifactKind.ARCHITECTURE]["components"][5]
    component["validation_required"] = True
    component["validation_reason"] = "Rests on an unconfirmed assumption."
    report = _report(items=items, contents=contents)
    listed = {entry.id: entry for entry in report.items_requiring_human_validation}
    assert listed["ASM_01"].kind == "assumption"
    assert listed["ARC_06"].artifact is ArtifactKind.ARCHITECTURE
    assert listed["ARC_06"].reason == "Rests on an unconfirmed assumption."


def test_the_clean_session_needs_no_human_validation():
    assert _report().items_requiring_human_validation == []


def test_every_check_id_appears_once_in_the_report():
    report = _report()
    assert [check.id for check in report.checks] == list(CheckId)


def test_a_flagged_element_with_no_references_is_still_listed():
    contents = fx.artifact_contents()
    enhancement = contents[ArtifactKind.FUNCTIONAL_SCOPE]["recommended_enhancements"][0]
    enhancement["related_req_ids"] = []
    enhancement["req_ids"] = []
    enhancement["validation_required"] = True
    report = _report(contents=contents)
    assert any(entry.id == "ENH_01" for entry in report.items_requiring_human_validation)
