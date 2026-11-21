"""Change-impact rules: affected outputs, untouched areas and stale artifacts."""

import pytest

from app.change_impact.rules import UnknownChange, regeneration_order
from app.change_impact.service import analyze_change
from app.domain.artifacts import ArtifactKind
from app.domain.changes import (
    ChangeRecord,
    ChangeRequest,
    ChangeType,
    ChangeValue,
    ImpactAction,
)
from app.domain.scope import (
    AiProviderPreference,
    ItemStatus,
    Priority,
    RoleRate,
    SecurityLevel,
)
from tests.unit import _fixtures as fx

CHANGE_ID = "CHG_01"


def _analyze(change, before=None, after=None):
    before = before or fx.session_state()
    after = after or fx.session_state()
    return analyze_change(change, before, after, CHANGE_ID, fx.NOW)


def _entry(analysis, kind):
    return next((entry for entry in analysis.affected if entry.artifact is kind), None)


def _kinds(analysis):
    return {entry.artifact for entry in analysis.affected}


def _config_change(key, old, new):
    return ChangeRequest(
        change_type=ChangeType.CONFIG_CHANGE,
        description=f"{key} changed",
        values=[ChangeValue(key=key, old_value=str(old), new_value=str(new))],
    )


# --- item changes ------------------------------------------------------------


def test_editing_a_requirement_affects_everything_that_cites_it():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_02"])
    analysis = _analyze(change)
    assert _kinds(analysis) == {
        ArtifactKind.PRD,
        ArtifactKind.FUNCTIONAL_SCOPE,
        ArtifactKind.ARCHITECTURE,
        ArtifactKind.ESTIMATE_DRIVERS,
        ArtifactKind.ESTIMATE,
        ArtifactKind.EXECUTIVE_SUMMARY,
    }
    assert "CAP_02" in _entry(analysis, ArtifactKind.FUNCTIONAL_SCOPE).element_ids
    assert "ARC_01" in _entry(analysis, ArtifactKind.ARCHITECTURE).element_ids
    assert analysis.affected_item_ids == ["FR_02"]


def test_the_unaffected_list_names_the_areas_the_change_does_not_touch():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_02"])
    analysis = _analyze(change)
    assert "Data strategy" in analysis.unaffected_summary
    assert "Integration architecture" in analysis.unaffected_summary
    assert "AI solution approach" in analysis.unaffected_summary
    # Partly affected areas say what stayed as reviewed.
    architecture = next(
        line for line in analysis.unaffected_summary if line.startswith("Solution architecture")
    )
    assert "ARC_04" in architecture


def test_an_item_change_pulls_in_the_workstreams_that_hold_the_elements():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_01"])
    analysis = _analyze(change)
    estimate = _entry(analysis, ArtifactKind.ESTIMATE)
    assert "WS_01" in estimate.element_ids
    assert "rom" in estimate.element_ids
    assert estimate.action is ImpactAction.RECALCULATE


def test_a_priority_change_to_high_also_refreshes_coverage():
    after = fx.session_state()
    next(item for item in after.items if item.id == "NFR_02").priority = Priority.HIGH
    change = ChangeRequest(
        change_type=ChangeType.SCOPE_ITEM_PRIORITY,
        item_ids=["NFR_02"],
        values=[ChangeValue(key="priority", old_value="medium", new_value="high")],
    )
    analysis = _analyze(change, after=after)
    assert analysis.coverage_affected is True


def test_a_status_change_moves_the_functional_scope_and_the_coverage():
    after = fx.session_state()
    next(item for item in after.items if item.id == "FR_03").status = ItemStatus.REJECTED
    change = ChangeRequest(
        change_type=ChangeType.SCOPE_ITEM_STATUS,
        item_ids=["FR_03"],
        values=[ChangeValue(key="status", old_value="approved", new_value="rejected")],
    )
    analysis = _analyze(change, after=after)
    assert ArtifactKind.FUNCTIONAL_SCOPE in _kinds(analysis)
    assert ArtifactKind.AI_STRATEGY in _kinds(analysis)
    assert analysis.coverage_affected is True


def test_confirming_an_assumption_affects_what_rests_on_it():
    change = ChangeRequest(change_type=ChangeType.ASSUMPTION_DECISION, item_ids=["ASM_01"])
    analysis = _analyze(change)
    assert "ARC_06" in _entry(analysis, ArtifactKind.ARCHITECTURE).element_ids
    assert ArtifactKind.PRD in _kinds(analysis)


def test_answering_a_question_affects_the_prd_section_that_lists_it():
    change = ChangeRequest(change_type=ChangeType.QUESTION_ANSWERED, item_ids=["Q_01"])
    analysis = _analyze(change)
    assert ArtifactKind.PRD in _kinds(analysis)


def test_changed_items_are_detected_when_the_request_names_none():
    after = fx.session_state()
    next(item for item in after.items if item.id == "FR_01").title = "Guided onboarding, revised"
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT)
    analysis = _analyze(change, after=after)
    assert analysis.affected_item_ids == ["FR_01"]


def test_an_item_change_with_nothing_to_act_on_is_rejected():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT)
    with pytest.raises(UnknownChange):
        _analyze(change)


# --- configuration changes ---------------------------------------------------


def test_a_platform_change_regenerates_the_architecture_and_relinks_the_strategies():
    before = fx.session_state()
    after = fx.session_state()
    after.cloud_platform = "aws"
    analysis = _analyze(_config_change("cloud_platform", "azure", "aws"), before, after)
    architecture = _entry(analysis, ArtifactKind.ARCHITECTURE)
    assert architecture.action is ImpactAction.REGENERATE
    assert "ARC_01" in architecture.element_ids
    for kind in (ArtifactKind.DATA_STRATEGY, ArtifactKind.INTEGRATION_ARCHITECTURE):
        assert _entry(analysis, kind).action is ImpactAction.RELINK
    assert _entry(analysis, ArtifactKind.AI_STRATEGY).action is ImpactAction.RELINK


def test_a_platform_change_does_not_make_the_strategies_stale():
    after = fx.session_state()
    after.cloud_platform = "gcp"
    analysis = _analyze(_config_change("cloud_platform", "azure", "gcp"), after=after)
    assert ArtifactKind.DATA_STRATEGY not in analysis.stale_kinds
    assert ArtifactKind.INTEGRATION_ARCHITECTURE not in analysis.stale_kinds
    assert ArtifactKind.AI_STRATEGY not in analysis.stale_kinds
    assert ArtifactKind.ARCHITECTURE in analysis.stale_kinds
    assert ArtifactKind.ESTIMATE in analysis.stale_kinds


def test_more_users_touch_scaling_requirements_components_and_the_test_effort():
    after = fx.session_state()
    after.config.expected_users = 500000
    analysis = _analyze(_config_change("expected_users", 50000, 500000), after=after)
    assert analysis.affected_item_ids == ["NFR_01", "NFR_02"]
    components = _entry(analysis, ArtifactKind.ARCHITECTURE).element_ids
    assert components == ["ARC_01", "ARC_02", "ARC_03", "ARC_07"]
    estimate = _entry(analysis, ArtifactKind.ESTIMATE)
    assert "WS_04" in estimate.element_ids and "rom" in estimate.element_ids
    assert "Integration architecture" in analysis.unaffected_summary
    assert "PRD and customer objectives" in analysis.unaffected_summary


def test_a_new_deadline_only_moves_the_timeline_and_the_confidence():
    after = fx.session_state()
    after.config.delivery_deadline = None
    analysis = _analyze(_config_change("delivery_deadline", "2027-03-31", ""), after=after)
    assert _kinds(analysis) == {ArtifactKind.ESTIMATE}
    assert _entry(analysis, ArtifactKind.ESTIMATE).element_ids == ["timeline", "overall_confidence"]


def test_a_rate_card_change_touches_only_the_estimate_and_the_rom():
    after = fx.session_state()
    after.config.rate_card_id = "eur-standard"
    analysis = _analyze(_config_change("rate_card_id", "usd-standard", "eur-standard"), after=after)
    assert _kinds(analysis) == {ArtifactKind.ESTIMATE}
    assert _entry(analysis, ArtifactKind.ESTIMATE).element_ids == ["rom"]
    assert analysis.stale_kinds == [ArtifactKind.ESTIMATE]


def test_an_effort_input_change_names_effort_timeline_and_rom():
    after = fx.session_state()
    after.config.testing_level = "extended"
    analysis = _analyze(_config_change("testing_level", "standard", "extended"), after=after)
    assert _entry(analysis, ArtifactKind.ESTIMATE).element_ids == ["effort", "timeline", "rom"]


def test_a_team_size_change_names_the_timeline_only():
    after = fx.session_state()
    analysis = _analyze(
        _config_change("team_sizes", [], [{"workstream_type": "application", "size": 6}]),
        after=after,
    )
    assert _entry(analysis, ArtifactKind.ESTIMATE).element_ids == ["timeline"]
    assert "Solution architecture" in analysis.unaffected_summary


def test_a_contingency_change_touches_only_the_estimate():
    after = fx.session_state()
    after.config.contingency_pct = 0.25
    analysis = _analyze(_config_change("contingency_pct", 0.15, 0.25), after=after)
    assert _kinds(analysis) == {ArtifactKind.ESTIMATE}


def test_a_role_rate_override_only_reprices_the_rom():
    after = fx.session_state()
    after.config.rate_overrides = [RoleRate(role="QA Engineer", rate_per_person_week=7000)]
    analysis = _analyze(_config_change("rate_overrides", "[]", "QA Engineer: 7000"), after=after)
    assert _kinds(analysis) == {ArtifactKind.ESTIMATE}
    assert _entry(analysis, ArtifactKind.ESTIMATE).element_ids == ["rom"]


def test_a_security_change_moves_security_items_components_and_privacy_sections():
    after = fx.session_state()
    after.config.security_level = SecurityLevel.REGULATED
    analysis = _analyze(_config_change("security_level", "elevated", "regulated"), after=after)
    assert analysis.affected_item_ids == ["SEC_01"]
    assert _entry(analysis, ArtifactKind.ARCHITECTURE).element_ids == ["ARC_04", "ARC_08"]
    assert _entry(analysis, ArtifactKind.DATA_STRATEGY).element_ids == ["privacy_security"]
    assert ArtifactKind.ESTIMATE in _kinds(analysis)


def test_regulatory_constraints_follow_the_same_rule_as_the_security_level():
    after = fx.session_state()
    after.config.regulatory_constraints = ["GDPR", "PCI-DSS"]
    analysis = _analyze(
        _config_change("regulatory_constraints", "GDPR", "GDPR,PCI-DSS"), after=after
    )
    assert _entry(analysis, ArtifactKind.DATA_STRATEGY).element_ids == ["privacy_security"]


def test_a_region_change_moves_where_data_lives_not_the_estimate():
    after = fx.session_state()
    after.config.target_regions = ["eu-west", "us-east"]
    analysis = _analyze(_config_change("target_regions", "eu-west", "eu-west,us-east"), after=after)
    architecture = _entry(analysis, ArtifactKind.ARCHITECTURE)
    assert architecture is not None and architecture.action is ImpactAction.REGENERATE
    assert architecture.element_ids  # storage, availability and recovery components
    assert _entry(analysis, ArtifactKind.DATA_STRATEGY).element_ids == ["privacy_security"]
    # The engine never reads the regions, so claiming an effort or ROM change would be false.
    assert ArtifactKind.ESTIMATE not in _kinds(analysis)


def test_an_ai_provider_change_regenerates_the_ai_strategy_and_the_ai_components():
    after = fx.session_state()
    after.config.ai_provider_preference = AiProviderPreference.OPEN_SOURCE
    analysis = _analyze(
        _config_change("ai_provider_preference", "platform_native", "open_source"), after=after
    )
    ai_strategy = _entry(analysis, ArtifactKind.AI_STRATEGY)
    assert ai_strategy.action is ImpactAction.REGENERATE
    assert _entry(analysis, ArtifactKind.ARCHITECTURE).element_ids == ["ARC_06"]
    assert "Data strategy" in analysis.unaffected_summary


def test_a_configuration_change_without_a_difference_is_rejected():
    change = ChangeRequest(change_type=ChangeType.CONFIG_CHANGE)
    with pytest.raises(UnknownChange):
        _analyze(change)


def test_an_unknown_configuration_key_is_rejected():
    with pytest.raises(UnknownChange):
        _analyze(_config_change("favourite_colour", "red", "blue"))


# --- estimate units and regeneration order -----------------------------------


def test_a_complexity_edit_only_recalculates_the_estimate():
    change = ChangeRequest(change_type=ChangeType.UNIT_COMPLEXITY, item_ids=["CAP_01"])
    analysis = _analyze(change)
    assert _kinds(analysis) == {ArtifactKind.ESTIMATE}
    estimate = _entry(analysis, ArtifactKind.ESTIMATE)
    assert estimate.element_ids == ["CAP_01", "WS_01", "effort", "timeline", "rom"]
    assert estimate.action is ImpactAction.RECALCULATE


def test_a_complexity_change_must_name_its_units():
    change = ChangeRequest(change_type=ChangeType.UNIT_COMPLEXITY)
    with pytest.raises(UnknownChange):
        _analyze(change)


def test_regeneration_order_follows_the_dependency_chain():
    stale = [
        ArtifactKind.ESTIMATE,
        ArtifactKind.EXECUTIVE_SUMMARY,
        ArtifactKind.ARCHITECTURE,
        ArtifactKind.PRD,
        ArtifactKind.AI_STRATEGY,
        ArtifactKind.FUNCTIONAL_SCOPE,
        ArtifactKind.ESTIMATE_DRIVERS,
    ]
    assert regeneration_order(stale) == [
        ArtifactKind.PRD,
        ArtifactKind.FUNCTIONAL_SCOPE,
        ArtifactKind.ARCHITECTURE,
        ArtifactKind.AI_STRATEGY,
        ArtifactKind.ESTIMATE_DRIVERS,
        ArtifactKind.ESTIMATE,
        ArtifactKind.EXECUTIVE_SUMMARY,
    ]


def test_regeneration_order_is_stable_and_removes_duplicates():
    assert regeneration_order([ArtifactKind.PRD, ArtifactKind.PRD]) == [ArtifactKind.PRD]
    assert regeneration_order([]) == []


def test_only_artifacts_the_session_has_can_be_affected():
    after = fx.session_state()
    after.artifacts.pop(ArtifactKind.ARCHITECTURE)
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_02"])
    analysis = _analyze(change, after=after)
    assert ArtifactKind.ARCHITECTURE not in _kinds(analysis)


def test_the_analysis_is_a_change_record_the_api_can_return():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_02"])
    record = _analyze(change)
    assert isinstance(record, ChangeRecord)
    assert record.id == CHANGE_ID
    assert record.session_id == fx.SESSION_ID
    assert record.scope_version == fx.SCOPE_VERSION
    assert record.request is change
    assert record.affected[0].action is ImpactAction.REGENERATE
    assert record.unaffected_summary


def test_every_change_asks_for_the_quality_gate_to_run_again():
    change = ChangeRequest(change_type=ChangeType.SCOPE_ITEM_EDIT, item_ids=["FR_02"])
    analysis = _analyze(change)
    assert analysis.quality_gate_affected is True
    assert "Run the quality gate again before export." in analysis.suggested_actions
