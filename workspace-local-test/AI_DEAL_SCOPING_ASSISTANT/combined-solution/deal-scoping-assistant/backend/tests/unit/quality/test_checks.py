"""Each of the 16 checks: one clean case and one broken case."""

from app.domain.artifacts import ArtifactKind, ArtifactStatus
from app.domain.estimation import BlockedLine, MissingInput
from app.domain.quality import CheckStatus, Severity
from app.domain.scope import AnswerStatus, ConfirmationStatus, ItemStatus
from app.quality.checks import (
    ALL_CHECKS,
    PAIR_CHECKS,
    pairwise_findings,
    qg_01_high_priority_coverage,
    qg_02_uncovered_requirements,
    qg_03_unsupported_additions,
    qg_04_components_without_justification,
    qg_05_integrations_in_delivery_plan,
    qg_06_ai_use_case_completeness,
    qg_07_missing_estimation_inputs,
    qg_08_unresolved_questions,
    qg_09_conflicting_technology,
    qg_10_estimate_consistency,
    qg_11_assumptions_requiring_validation,
    qg_12_stale_or_missing_artifacts,
    qg_13_cross_document_consistency,
    qg_14_ai_requirement_coverage,
    qg_15_requirement_to_estimate,
    qg_16_requirement_to_architecture,
)
from tests.unit import _fixtures as fx


def test_the_catalogue_holds_all_sixteen_checks():
    results = [check(fx.quality_context()) for check in ALL_CHECKS]
    assert len(results) == 16
    assert len({result.id for result in results}) == 16
    assert all(result.status is CheckStatus.PASSED for result in results)


# --- QG_01 -------------------------------------------------------------------


def test_qg_01_passes_when_every_high_priority_requirement_is_covered():
    assert qg_01_high_priority_coverage(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_01_fails_when_a_must_requirement_has_no_capability():
    contents = fx.artifact_contents()
    capability = contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][3]
    capability["included_req_ids"] = ["DATA_01"]
    capability["req_ids"] = ["DATA_01"]
    result = qg_01_high_priority_coverage(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert result.severity is Severity.ERROR
    assert "SEC_01" in result.affected_ids


# --- QG_02 -------------------------------------------------------------------


def test_qg_02_passes_at_full_coverage():
    assert qg_02_uncovered_requirements(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_02_warns_about_an_uncovered_requirement():
    contents = fx.artifact_contents()
    capability = contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][1]
    capability["included_req_ids"] = ["FR_02"]
    capability["req_ids"] = ["FR_02"]
    result = qg_02_uncovered_requirements(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert result.affected_ids == ["NFR_02"]


# --- QG_03 -------------------------------------------------------------------


def test_qg_03_passes_when_everything_is_grounded():
    assert qg_03_unsupported_additions(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_03_warns_about_an_enhancement_without_a_requirement():
    contents = fx.artifact_contents()
    enhancement = contents[ArtifactKind.FUNCTIONAL_SCOPE]["recommended_enhancements"][0]
    enhancement["related_req_ids"] = []
    enhancement["req_ids"] = []
    result = qg_03_unsupported_additions(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert result.affected_ids == ["ENH_01"]


# --- QG_04 -------------------------------------------------------------------


def test_qg_04_passes_when_every_component_is_justified():
    assert qg_04_components_without_justification(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_04_fails_for_a_component_without_a_requirement():
    contents = fx.artifact_contents()
    contents[ArtifactKind.ARCHITECTURE]["components"][2]["supported_ids"] = []
    result = qg_04_components_without_justification(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert result.affected_ids == ["ARC_03"]


# --- QG_05 -------------------------------------------------------------------


def test_qg_05_passes_when_integrations_are_designed_and_planned():
    assert qg_05_integrations_in_delivery_plan(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_05_fails_when_an_integration_is_in_no_workstream():
    contents = fx.artifact_contents()
    contents[ArtifactKind.ESTIMATE_DRIVERS]["workstreams"][0]["integration_ids"] = []
    result = qg_05_integrations_in_delivery_plan(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert result.affected_ids == ["IA_01"]


# --- QG_06 -------------------------------------------------------------------


def test_qg_06_passes_for_a_complete_ai_use_case():
    assert qg_06_ai_use_case_completeness(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_06_warns_when_evaluation_and_human_review_are_missing():
    contents = fx.artifact_contents()
    use_case = contents[ArtifactKind.AI_STRATEGY]["use_cases"][0]
    use_case["evaluation"] = ""
    use_case["human_review"] = ""
    result = qg_06_ai_use_case_completeness(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert "evaluation" in result.message and "human_review" in result.message


# --- QG_07 -------------------------------------------------------------------


def test_qg_07_passes_when_every_input_is_present():
    assert qg_07_missing_estimation_inputs(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_07_fails_on_a_blocked_commercial_line():
    estimate = fx.estimate()
    estimate.blocked_lines = [BlockedLine(label="ROM", reason="no rate for Data Engineer")]
    estimate.missing_inputs = [
        MissingInput(key="rate_card_id", impact="The ROM cannot be calculated.")
    ]
    result = qg_07_missing_estimation_inputs(fx.quality_context(current_estimate=estimate))
    assert result.status is CheckStatus.FAILED
    assert "no rate for Data Engineer" in result.message


# --- QG_08 -------------------------------------------------------------------


def test_qg_08_passes_when_every_question_is_answered():
    assert qg_08_unresolved_questions(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_08_fails_when_an_open_question_blocks_a_high_priority_item():
    items = fx.scope_items()
    question = next(item for item in items if item.id == "Q_01")
    assert question.details.question is not None
    question.details.question.answer_status = AnswerStatus.OPEN
    result = qg_08_unresolved_questions(fx.quality_context(items=items))
    assert result.status is CheckStatus.FAILED
    assert result.severity is Severity.ERROR
    assert result.affected_ids == ["Q_01"]


# --- QG_09 -------------------------------------------------------------------


def test_qg_09_passes_when_services_match_the_platform():
    assert qg_09_conflicting_technology(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_09_fails_on_a_service_that_is_not_in_the_platform_catalog():
    contents = fx.artifact_contents()
    contents[ArtifactKind.ARCHITECTURE]["components"][1]["cloud_service"] = "AWS Lambda"
    result = qg_09_conflicting_technology(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert result.affected_ids == ["ARC_02"]


# --- QG_10 -------------------------------------------------------------------


def test_qg_10_passes_when_the_numbers_add_up():
    assert qg_10_estimate_consistency(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_10_fails_when_the_workstream_lines_do_not_add_up():
    estimate = fx.estimate()
    estimate.effort_low += 5
    result = qg_10_estimate_consistency(fx.quality_context(current_estimate=estimate))
    assert result.status is CheckStatus.FAILED
    assert "adds up to" in result.message


def test_qg_10_fails_when_the_estimate_used_an_older_configuration():
    estimate = fx.estimate()
    estimate.config_hash = "cfg-old"
    result = qg_10_estimate_consistency(fx.quality_context(current_estimate=estimate))
    assert result.status is CheckStatus.FAILED


# --- QG_11 -------------------------------------------------------------------


def test_qg_11_passes_when_no_pending_assumption_is_in_use():
    assert qg_11_assumptions_requiring_validation(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_11_warns_about_a_pending_assumption_the_architecture_relies_on():
    items = fx.scope_items()
    assumption = next(item for item in items if item.id == "ASM_01")
    assert assumption.details.assumption is not None
    assumption.details.assumption.confirmation_status = ConfirmationStatus.PENDING
    result = qg_11_assumptions_requiring_validation(fx.quality_context(items=items))
    assert result.status is CheckStatus.WARNING
    assert "ASM_01" in result.affected_ids


def test_qg_11_also_lists_elements_flagged_for_validation():
    contents = fx.artifact_contents()
    contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][2]["validation_required"] = True
    result = qg_11_assumptions_requiring_validation(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert "CAP_03" in result.affected_ids


# --- QG_12 -------------------------------------------------------------------


def test_qg_12_passes_when_every_artifact_is_fresh():
    assert qg_12_stale_or_missing_artifacts(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_12_warns_about_a_stale_artifact():
    statuses = fx.artifact_statuses()
    statuses[ArtifactKind.ARCHITECTURE] = ArtifactStatus.STALE
    result = qg_12_stale_or_missing_artifacts(fx.quality_context(statuses=statuses))
    assert result.status is CheckStatus.WARNING
    assert result.affected_ids == ["architecture"]


def test_qg_12_fails_when_a_required_artifact_is_missing():
    contents = fx.artifact_contents()
    contents.pop(ArtifactKind.PRD)
    result = qg_12_stale_or_missing_artifacts(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert result.affected_ids == ["prd"]


# --- QG_13 -------------------------------------------------------------------


def test_qg_13_runs_nine_pairwise_document_checks():
    assert len(PAIR_CHECKS) == 9
    assert pairwise_findings(fx.quality_context()) == []


def test_qg_13_passes_on_a_consistent_package():
    assert qg_13_cross_document_consistency(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_13_fails_on_a_dangling_architecture_reference():
    contents = fx.artifact_contents()
    contents[ArtifactKind.DATA_STRATEGY]["privacy_security"]["arc_ids"] = ["ARC_99"]
    result = qg_13_cross_document_consistency(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert "ARC_99" in result.affected_ids
    assert "Architecture ↔ Data strategy" in result.message


def test_qg_13_flags_a_capability_that_the_delivery_plan_forgot():
    contents = fx.artifact_contents()
    contents[ArtifactKind.ESTIMATE_DRIVERS]["workstreams"][1]["capability_ids"] = []
    findings = pairwise_findings(fx.quality_context(contents=contents))
    assert any(finding.pair == "Functional scope ↔ Estimate" for finding in findings)


def test_qg_13_flags_a_prd_that_cites_a_rejected_requirement():
    items = fx.scope_items()
    next(item for item in items if item.id == "FR_02").status = ItemStatus.REJECTED
    findings = pairwise_findings(fx.quality_context(items=items))
    assert any(finding.pair == "Scope ↔ PRD" and finding.hard for finding in findings)


def _without_ai_components(contents):
    architecture = contents[ArtifactKind.ARCHITECTURE]
    architecture["components"] = [
        component
        for component in architecture["components"]
        if component["area"] != "ai_and_ml_services"
    ]
    return contents


def test_qg_13_fails_when_a_grounded_ai_use_case_has_no_ai_component():
    contents = _without_ai_components(fx.artifact_contents())
    result = qg_13_cross_document_consistency(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.FAILED
    assert "AI_01" in result.affected_ids


def test_qg_13_only_warns_when_a_recommended_ai_use_case_has_no_ai_component():
    contents = _without_ai_components(fx.artifact_contents())
    contents[ArtifactKind.AI_STRATEGY]["use_cases"][0]["basis"] = "recommended"
    result = qg_13_cross_document_consistency(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert "AI_01" in result.affected_ids
    assert "recommended AI use cases" in result.message


# --- QG_14 -------------------------------------------------------------------


def test_qg_14_passes_when_ai_requirements_are_answered():
    assert qg_14_ai_requirement_coverage(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_14_warns_when_an_ai_requirement_has_no_use_case():
    contents = fx.artifact_contents()
    use_case = contents[ArtifactKind.AI_STRATEGY]["use_cases"][0]
    use_case["req_ids"] = []
    result = qg_14_ai_requirement_coverage(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert "FR_03" in result.affected_ids and "AI_01" in result.affected_ids


# --- QG_15 -------------------------------------------------------------------


def test_qg_15_passes_when_every_requirement_sits_in_a_workstream():
    assert qg_15_requirement_to_estimate(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_15_warns_when_a_requirement_carries_no_effort():
    contents = fx.artifact_contents()
    workstream = contents[ArtifactKind.ESTIMATE_DRIVERS]["workstreams"][2]
    workstream["req_ids"] = ["SEC_01", "NFR_01"]
    result = qg_15_requirement_to_estimate(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert result.affected_ids == ["DATA_01"]


# --- QG_16 -------------------------------------------------------------------


def test_qg_16_passes_when_every_requirement_has_a_component():
    assert qg_16_requirement_to_architecture(fx.quality_context()).status is CheckStatus.PASSED


def test_qg_16_warns_when_no_component_supports_a_requirement():
    contents = fx.artifact_contents()
    for index in (3, 7):
        component = contents[ArtifactKind.ARCHITECTURE]["components"][index]
        component["supported_ids"] = ["FR_01"]
    result = qg_16_requirement_to_architecture(fx.quality_context(contents=contents))
    assert result.status is CheckStatus.WARNING
    assert result.affected_ids == ["SEC_01"]
