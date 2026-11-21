"""Confidence comes from the inputs, and it is decided before any range is applied."""

import pytest

from app.domain.artifacts import Complexity, EstimateDrivers, UnitType
from app.domain.estimation import ConfidenceLevel, EstimationConfig, EstimationRules
from app.domain.scope import GapCriticality, Origin, ScopeItem, SessionConfig
from app.estimation.confidence import (
    Assessment,
    ScopeIndex,
    assess_workstream,
    reduce_one_step,
    worst,
)
from app.estimation.config import build_config
from app.estimation.engine import calculate_estimate

from .conftest import NOW, gap, item, nfr, open_question, pending_assumption, unit, workstream


def _assess(scope: list[ScopeItem], rules: EstimationRules, **kwargs) -> Assessment:
    return assess_workstream(workstream(**kwargs), ScopeIndex(scope), rules)


def test_customer_stated_scope_with_nothing_open_is_high(rules: EstimationRules) -> None:
    assessment = _assess([item("FR_01"), item("FR_02")], rules)
    assert assessment.level is ConfidenceLevel.HIGH
    assert assessment.limitations == []


def test_inferred_requirements_lower_the_level(rules: EstimationRules) -> None:
    scope = [item("FR_01", origin=Origin.AI_INFERRED), item("FR_02")]
    assessment = _assess(scope, rules)
    assert assessment.level is ConfidenceLevel.LOW  # half the scope is not customer-stated
    assert "inferred or assumed" in assessment.limitations[0]


def test_one_inferred_requirement_in_four_is_medium(rules: EstimationRules) -> None:
    scope = [item("FR_01", origin=Origin.AI_INFERRED)] + [item(f"FR_0{n}") for n in (2, 3, 4)]
    assessment = _assess(scope, rules, req_ids=["FR_01", "FR_02", "FR_03", "FR_04"])
    assert assessment.level is ConfidenceLevel.MEDIUM


def test_open_questions_and_pending_assumptions_are_named(rules: EstimationRules) -> None:
    scope = [
        item("FR_01"),
        item("FR_02"),
        open_question("Q_01", ["FR_01"]),
        pending_assumption("ASM_01", ["FR_02"]),
    ]
    assessment = _assess(scope, rules)
    assert assessment.level is ConfidenceLevel.MEDIUM
    assert any("Q_01" in text for text in assessment.limitations)
    assert any("ASM_01" in text for text in assessment.limitations)


def test_three_open_questions_drop_to_low(rules: EstimationRules) -> None:
    scope = [item("FR_01"), item("FR_02")] + [
        open_question(f"Q_0{n}", ["FR_01"]) for n in (1, 2, 3)
    ]
    assert _assess(scope, rules).level is ConfidenceLevel.LOW


def test_a_critical_gap_on_the_workstream_drops_to_low(rules: EstimationRules) -> None:
    scope = [
        item("FR_01"),
        item("FR_02"),
        gap("GAP_01", ["Customer Portal"], GapCriticality.HIGH),
    ]
    assessment = _assess(scope, rules)
    assert assessment.level is ConfidenceLevel.LOW
    assert any("GAP_01" in text for text in assessment.limitations)


def test_unknown_requirement_ids_are_named_not_ignored(rules: EstimationRules) -> None:
    assessment = _assess([item("FR_01")], rules)
    assert any("FR_02" in text for text in assessment.limitations)


def test_worst_and_reduce_helpers() -> None:
    assert worst([ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM]) is ConfidenceLevel.MEDIUM
    assert reduce_one_step(ConfidenceLevel.HIGH) is ConfidenceLevel.MEDIUM
    assert reduce_one_step(ConfidenceLevel.LOW) is ConfidenceLevel.LOW


@pytest.mark.parametrize(
    ("level", "low", "high"),
    [(ConfidenceLevel.HIGH, 8.1, 9.9), (ConfidenceLevel.MEDIUM, 7.2, 10.8)],
)
def test_the_spread_follows_the_confidence_decided_first(
    drivers: EstimateDrivers,
    config: EstimationConfig,
    level: ConfidenceLevel,
    low: float,
    high: float,
) -> None:
    """Same 9.0 person-weeks of build; only the confidence changes the range."""
    scope = [item("FR_01"), item("FR_02")]
    if level is ConfidenceLevel.MEDIUM:
        scope.append(open_question("Q_01", ["FR_01"]))
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = estimate.workstreams[0]
    assert line.confidence is level
    assert (line.effort_low, line.effort_high) == (low, high)


def test_low_confidence_uses_the_widest_spread(
    drivers: EstimateDrivers, config: EstimationConfig
) -> None:
    scope = [item("FR_01", origin=Origin.ASSUMED, related_ids=["GAP_01"]), item("FR_02")]
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = estimate.workstreams[0]
    assert line.confidence is ConfidenceLevel.LOW
    assert (line.effort_low, line.effort_high) == (5.85, 12.15)


def test_missing_expected_users_lowers_confidence_and_flags_the_line(
    drivers: EstimateDrivers,
) -> None:
    scope = [item("FR_01"), item("FR_02"), nfr("NFR_01")]
    config = build_config(SessionConfig(rate_card_id="usd-standard", environments_count=2))
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert estimate.workstreams[0].confidence is ConfidenceLevel.HIGH  # the line itself is fine
    assert estimate.overall_confidence is ConfidenceLevel.MEDIUM
    missing = [m for m in estimate.missing_inputs if m.key == "expected_users"]
    assert missing and "infrastructure lines" in missing[0].affected_components


def test_expected_users_given_keeps_confidence_high(drivers: EstimateDrivers) -> None:
    scope = [item("FR_01"), item("FR_02"), nfr("NFR_01")]
    config = build_config(
        SessionConfig(rate_card_id="usd-standard", environments_count=2, expected_users=5000)
    )
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert estimate.overall_confidence is ConfidenceLevel.HIGH
    assert not [m for m in estimate.missing_inputs if m.key == "expected_users"]


def test_an_infrastructure_workstream_is_flagged_when_the_volume_is_unknown() -> None:
    drivers = EstimateDrivers(
        units=[
            unit(
                "ARC_01",
                unit_type=UnitType.ARCHITECTURE_COMPONENT,
                complexity=Complexity.MEDIUM,
            )
        ],
        workstreams=[workstream(req_ids=["NFR_01"], arc_ids=["ARC_01"])],
    )
    scope = [nfr("NFR_01")]
    config = build_config(SessionConfig(rate_card_id="usd-standard", environments_count=2))
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = estimate.workstreams[0]
    assert line.confidence is ConfidenceLevel.MEDIUM
    assert any("user volume" in text for text in line.limitations)


def test_the_engine_uses_the_same_input_only_assessment(
    drivers: EstimateDrivers, config: EstimationConfig, rules: EstimationRules
) -> None:
    """The line's confidence is the one the scope alone gives, decided before the range."""
    scope = [item("FR_01", origin=Origin.AI_INFERRED), item("FR_02")]
    standalone = assess_workstream(workstream(), ScopeIndex(scope), rules)
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = estimate.workstreams[0]
    assert line.confidence is standalone.level
    assert line.limitations == standalone.limitations
