"""The engine: every number has to follow the visible rules, exactly."""

from datetime import timedelta

from app.domain.artifacts import Complexity, EstimateDrivers, UnitType
from app.domain.estimation import (
    ConfidenceLevel,
    EstimationConfig,
    EstimationRules,
    RateCard,
    RoleRate,
)
from app.domain.scope import (
    BlendedRateMode,
    DataMigration,
    SecurityLevel,
    SessionConfig,
    TeamSizeEntry,
)
from app.domain.scope import TestingLevel as _TestingLevel  # alias: pytest must not collect it
from app.estimation.config import build_config, load_rate_cards
from app.estimation.engine import calculate_estimate

from .conftest import NOW, item, unit, workstream

# Blended rates from the seeded USD card and the seeded role mixes.
APPLICATION_RATE = 7700.0
DISCOVERY_RATE = 8720.0
TESTING_RATE = 7300.0
DEPLOYMENT_RATE = 8500.0


def _trace_result(traced: object, label: str) -> float:
    entries = [t for t in traced.trace if t.label == label]  # type: ignore[attr-defined]
    assert entries, f"no trace entry '{label}'"
    return entries[0].result


def _line(estimate: object, line_id: str) -> object:
    return next(w for w in estimate.workstreams if w.workstream_id == line_id)  # type: ignore[attr-defined]


# --- Step 1: unit effort and factors ----------------------------------------


def test_unit_efforts_sum_into_the_workstream(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = _line(estimate, "WS_01")
    assert _trace_result(line, "CAP_01 effort (capability, medium)") == 3.0
    assert _trace_result(line, "CAP_02 effort (capability, high)") == 6.0
    assert _trace_result(line, "WS_01 build effort") == 9.0


def test_factors_multiply_the_base_effort(drivers: EstimateDrivers, scope: list) -> None:
    session = SessionConfig(
        rate_card_id="usd-standard",
        environments_count=3,
        security_level=SecurityLevel.REGULATED,
        testing_level=_TestingLevel.EXTENDED,
        data_migration=DataMigration.HEAVY,
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    line = _line(estimate, "WS_01")
    # 1.3 security x 1.15 testing x 1.05 environments; migration does not touch capabilities.
    assert _trace_result(line, "CAP_01 factor product") == 1.56975
    assert _trace_result(line, "CAP_01 effort (capability, medium)") == 4.70925
    assert _trace_result(line, "WS_01 build effort") == 14.12775
    assert (line.effort_low, line.effort_high) == (12.71, 15.54)


def test_data_migration_only_touches_data_and_integration_units() -> None:
    drivers = EstimateDrivers(
        units=[
            unit("CAP_01", "WS_01", UnitType.CAPABILITY, Complexity.MEDIUM),
            unit("DOM_01", "WS_02", UnitType.DATA_DOMAIN, Complexity.MEDIUM),
        ],
        workstreams=[workstream(), workstream("WS_02", "Data", req_ids=["FR_01"])],
    )
    session = SessionConfig(
        rate_card_id="usd-standard", environments_count=2, data_migration=DataMigration.HEAVY
    )
    estimate = calculate_estimate(
        drivers, [item("FR_01"), item("FR_02")], build_config(session), {}, now=NOW
    )
    assert _trace_result(_line(estimate, "WS_01"), "CAP_01 factor product") == 1.0
    assert _trace_result(_line(estimate, "WS_02"), "DOM_01 factor product") == 1.25
    assert _trace_result(_line(estimate, "WS_02"), "DOM_01 effort (data_domain, medium)") == 3.125


def test_an_integration_is_priced_by_its_pattern(config: EstimationConfig) -> None:
    drivers = EstimateDrivers(
        units=[unit("IA_01", "WS_01", UnitType.INTEGRATION, Complexity.MEDIUM)],
        workstreams=[workstream()],
    )
    estimate = calculate_estimate(
        drivers, [item("FR_01"), item("FR_02")], config, {"IA_01": "event"}, now=NOW
    )
    assert _trace_result(_line(estimate, "WS_01"), "IA_01 effort (integration, medium)") == 3.0


# --- Step 4: overheads -------------------------------------------------------


def test_overheads_are_a_share_of_the_build_effort(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    discovery = _line(estimate, "OVH_DISCOVERY")
    testing = _line(estimate, "OVH_TESTING")
    deployment = _line(estimate, "OVH_DEPLOYMENT")
    assert (discovery.effort_low, discovery.effort_high) == (0.97, 1.19)  # 12% of 8.1 and 9.9
    assert (testing.effort_low, testing.effort_high) == (1.46, 1.78)  # 18%
    assert (deployment.effort_low, deployment.effort_high) == (0.65, 0.79)  # 8%
    assert all(line.overhead for line in (discovery, testing, deployment))
    assert estimate.effort_low == 11.0
    assert estimate.effort_high == 14.0


# --- Step 6: contingency and ROM --------------------------------------------


def test_contingency_is_applied_exactly_once(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    line = _line(estimate, "WS_01")
    assert _trace_result(line, "WS_01 blended rate (USD per person-week)") == APPLICATION_RATE
    # base effort x rate x (1 + contingency), not the effort that already includes contingency.
    assert _trace_result(line, "WS_01 ROM high") == 9.9 * APPLICATION_RATE * 1.15
    assert _trace_result(line, "WS_01 ROM low") == 8.1 * APPLICATION_RATE * 1.15
    assert estimate.effort_incl_contingency_high == 16.0  # 13.662 x 1.15, information only
    assert estimate.rom.contingency_pct == 15.0


def test_the_rom_total_is_the_sum_of_the_priced_lines(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    expected_high = 1.15 * (
        9.9 * APPLICATION_RATE
        + 1.19 * DISCOVERY_RATE
        + 1.78 * TESTING_RATE
        + 0.79 * DEPLOYMENT_RATE
    )
    assert round(_trace_result(estimate, "Total ROM (high, before rounding)"), 2) == round(
        expected_high, 2
    )
    assert estimate.rom.amount_high == 122000.0
    assert estimate.rom.amount_low == 100000.0
    assert estimate.rom.currency == "USD"


def test_an_explicit_blended_rate_replaces_the_role_mix(
    drivers: EstimateDrivers, scope: list
) -> None:
    session = SessionConfig(
        rate_card_id="usd-standard",
        environments_count=2,
        blended_rate_mode=BlendedRateMode.EXPLICIT,
        explicit_blended_rate=8000,
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert _trace_result(_line(estimate, "WS_01"), "WS_01 ROM high") == 9.9 * 8000 * 1.15
    assert estimate.rom.rate_basis == "explicit blended rate per person-week"


def test_explicit_mode_without_a_rate_blocks_the_rom(drivers: EstimateDrivers, scope: list) -> None:
    session = SessionConfig(
        rate_card_id="usd-standard",
        environments_count=2,
        blended_rate_mode=BlendedRateMode.EXPLICIT,
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert estimate.rom.amount_high == 0.0
    assert "explicit_blended_rate" in [m.key for m in estimate.missing_inputs]
    assert estimate.totals_partial


def test_a_rate_change_moves_the_rom_by_the_same_factor(
    drivers: EstimateDrivers, scope: list
) -> None:
    usd = next(card for card in load_rate_cards() if card.id == "usd-standard")
    doubled = RateCard(
        id="usd-standard",
        name="Doubled",
        currency="USD",
        rates=[
            RoleRate(role=r.role, rate_per_person_week=r.rate_per_person_week * 2)
            for r in usd.rates
        ],
    )
    session = SessionConfig(rate_card_id="usd-standard", environments_count=2)
    base = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    changed = calculate_estimate(
        drivers, scope, build_config(session, rate_cards=(doubled,)), {}, now=NOW
    )
    assert _trace_result(_line(changed, "WS_01"), "WS_01 ROM high") == 2 * _trace_result(
        _line(base, "WS_01"), "WS_01 ROM high"
    )


def test_a_contingency_change_moves_the_rom_by_the_same_factor(
    drivers: EstimateDrivers, scope: list
) -> None:
    base = build_config(SessionConfig(rate_card_id="usd-standard", environments_count=2))
    raised = build_config(
        SessionConfig(rate_card_id="usd-standard", environments_count=2, contingency_pct=25)
    )
    first = calculate_estimate(drivers, scope, base, {}, now=NOW)
    second = calculate_estimate(drivers, scope, raised, {}, now=NOW)
    low = _trace_result(_line(first, "WS_01"), "WS_01 ROM high")
    high = _trace_result(_line(second, "WS_01"), "WS_01 ROM high")
    assert round(high / low, 10) == round(1.25 / 1.15, 10)


def test_the_eur_card_gives_a_eur_estimate(drivers: EstimateDrivers, scope: list) -> None:
    session = SessionConfig(rate_card_id="eur-standard", environments_count=2)
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert estimate.rom.currency == "EUR"
    assert _trace_result(_line(estimate, "WS_01"), "WS_01 blended rate (EUR per person-week)") == (
        7050.0
    )


def test_a_missing_role_rate_blocks_that_line_and_marks_the_total_partial(
    drivers: EstimateDrivers, scope: list
) -> None:
    usd = next(card for card in load_rate_cards() if card.id == "usd-standard")
    without_qa = RateCard(
        id="usd-standard",
        name="No QA rate",
        currency="USD",
        rates=[r for r in usd.rates if r.role != "QA Engineer"],
    )
    session = SessionConfig(rate_card_id="usd-standard", environments_count=2)
    estimate = calculate_estimate(
        drivers, scope, build_config(session, rate_cards=(without_qa,)), {}, now=NOW
    )
    blocked = _line(estimate, "WS_01")
    assert blocked.blocked is True
    assert "QA Engineer" in blocked.blocked_reason
    assert any("QA Engineer" in b.reason for b in estimate.blocked_lines)
    assert estimate.totals_partial
    # Only the discovery mix has no QA role, so only that line is priced.
    assert round(_trace_result(estimate, "Total ROM (high, before rounding)"), 2) == round(
        1.19 * DISCOVERY_RATE * 1.15, 2
    )
    # Partial totals drop the confidence to medium, so the ROM rounds to 5,000.
    assert estimate.overall_confidence is ConfidenceLevel.MEDIUM
    assert estimate.rom.amount_high == 10000.0
    assert any("partial" in text for text in estimate.confidence_limitations)


def test_no_rate_card_blocks_every_rom_line(drivers: EstimateDrivers, scope: list) -> None:
    session = SessionConfig(environments_count=2)  # no rate card selected
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert estimate.rom.amount_low == 0.0
    assert estimate.rom.currency == ""
    assert "rate_card_id" in [m.key for m in estimate.missing_inputs]
    assert all(line.blocked for line in estimate.workstreams)
    assert estimate.effort_high == 14.0  # effort and timeline are still calculated


# --- Step 5 and 7: timeline, deadline, rounding -----------------------------


def test_the_timeline_is_a_range_with_a_note_when_there_is_no_deadline(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert estimate.deadline_risk == ""
    note = next(m for m in estimate.missing_inputs if m.key == "delivery_deadline")
    assert "range" in note.impact
    assert estimate.timeline_weeks_low < estimate.timeline_weeks_high


def test_a_session_team_size_shortens_that_workstream_in_the_timeline(
    drivers: EstimateDrivers, scope: list
) -> None:
    # The application default is 5 people, so 10 halves that workstream's duration.
    session = SessionConfig(rate_card_id="usd-standard", environments_count=2)
    base = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    bigger = session.model_copy(
        update={"team_sizes": [TeamSizeEntry(workstream_type="application", team_size=10)]}
    )
    faster = calculate_estimate(drivers, scope, build_config(bigger), {}, now=NOW)
    assert _trace_result(faster, "WS_01 duration in 'Experience and Core Platform' (high)") == (
        _trace_result(base, "WS_01 duration in 'Experience and Core Platform' (high)") / 2
    )
    assert faster.timeline_weeks_high < base.timeline_weeks_high
    assert any("team of 10 people" in a and "set for this session" in a for a in faster.assumptions)
    assert any("team of 5 people" in a and "seeded default" in a for a in base.assumptions)


def test_a_deadline_before_the_high_timeline_is_a_delivery_risk(
    drivers: EstimateDrivers, scope: list
) -> None:
    deadline = (NOW + timedelta(days=7)).date()
    session = SessionConfig(
        rate_card_id="usd-standard", environments_count=2, delivery_deadline=deadline
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert "weeks remain" in estimate.deadline_risk
    assert estimate.overall_confidence is ConfidenceLevel.MEDIUM  # one step down from high


def test_a_deadline_after_the_high_timeline_is_not_a_risk(
    drivers: EstimateDrivers, scope: list
) -> None:
    deadline = (NOW + timedelta(days=200)).date()
    session = SessionConfig(
        rate_card_id="usd-standard", environments_count=2, delivery_deadline=deadline
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert estimate.deadline_risk == ""
    assert estimate.overall_confidence is ConfidenceLevel.HIGH


def test_milestones_sit_at_the_end_of_their_phase(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    names = [m.name for phase in estimate.phases for m in phase.milestones]
    assert names == ["Architecture signed off", "Portal feature complete", "Test exit", "Go live"]
    last = estimate.phases[-1].milestones[0]
    assert last.week_high == estimate.timeline_weeks_high
    assert last.week_low == estimate.timeline_weeks_low


def test_rounding_follows_the_confidence_level(drivers: EstimateDrivers, scope: list) -> None:
    from .conftest import open_question

    high = calculate_estimate(
        drivers, scope, build_config(SessionConfig(rate_card_id="usd-standard")), {}, now=NOW
    )
    low_scope = [*scope, *(open_question(f"Q_0{n}", ["FR_01"]) for n in (1, 2, 3))]
    low = calculate_estimate(
        drivers, low_scope, build_config(SessionConfig(rate_card_id="usd-standard")), {}, now=NOW
    )
    assert high.overall_confidence is ConfidenceLevel.HIGH
    assert high.rom.amount_high % 1000 == 0
    assert low.overall_confidence is ConfidenceLevel.LOW
    assert low.rom.amount_high % 10000 == 0
    assert float(high.effort_high).is_integer()


# --- Error entries: nothing is guessed --------------------------------------


def test_a_unit_pointing_at_a_missing_workstream_is_an_error_entry(
    scope: list, config: EstimationConfig
) -> None:
    drivers = EstimateDrivers(
        units=[unit("CAP_01"), unit("CAP_09", "WS_09")], workstreams=[workstream()]
    )
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    error = next(b for b in estimate.blocked_lines if b.label == "Unit CAP_09")
    assert "WS_09" in error.reason
    assert _trace_result(_line(estimate, "WS_01"), "WS_01 build effort") == 3.0


def test_an_integration_without_a_known_pattern_is_an_error_entry(
    scope: list, config: EstimationConfig
) -> None:
    drivers = EstimateDrivers(
        units=[unit("IA_01", "WS_01", UnitType.INTEGRATION)], workstreams=[workstream()]
    )
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert any("integration pattern" in b.reason for b in estimate.blocked_lines)
    assert _line(estimate, "WS_01").blocked is True
    assert estimate.totals_partial


def test_a_complexity_with_no_rule_is_an_error_entry_not_a_guess(
    drivers: EstimateDrivers, scope: list, rules: EstimationRules
) -> None:
    holed = rules.model_copy(
        update={
            "base_effort": [
                row
                for row in rules.base_effort
                if not (row.unit_type is UnitType.CAPABILITY and row.complexity is Complexity.HIGH)
            ]
        }
    )
    config = build_config(
        SessionConfig(rate_card_id="usd-standard", environments_count=2), rules=holed
    )
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert any("no base effort rule for capability" in b.reason for b in estimate.blocked_lines)
    assert _trace_result(_line(estimate, "WS_01"), "WS_01 build effort") == 3.0


# --- Nothing silently defaulted; same input, same output ---------------------


def test_every_default_used_is_written_out_as_an_assumption(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    texts = estimate.assumptions
    assert any("contingency_pct" in text for text in texts)
    assert any("security_level" in text for text in texts)
    assert any("team of 5" in text for text in texts)
    assert any("seeded role mix" in text for text in texts)
    assert any("workstream type 'application'" in text for text in texts)


def test_an_input_the_user_set_is_not_reported_as_an_assumption(
    drivers: EstimateDrivers, scope: list
) -> None:
    session = SessionConfig(rate_card_id="usd-standard", environments_count=2, contingency_pct=20)
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert not any("contingency_pct was not given" in text for text in estimate.assumptions)


def test_defaults_are_still_reported_after_a_database_round_trip(
    drivers: EstimateDrivers, scope: list
) -> None:
    # A stored config comes back with every field present, exactly as the API loads it.
    stored = SessionConfig(rate_card_id="usd-standard", environments_count=2).model_dump(
        mode="json"
    )
    reloaded = SessionConfig.model_validate(stored)
    texts = calculate_estimate(drivers, scope, build_config(reloaded), {}, now=NOW).assumptions
    assert any("contingency_pct was not given" in text for text in texts)
    assert any("productivity_factor was not given" in text for text in texts)
    assert not any("environments_count was not given" in text for text in texts)


def test_the_same_input_gives_an_identical_estimate(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    first = calculate_estimate(drivers, scope, config, {}, now=NOW)
    second = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert first.model_dump() == second.model_dump()
    assert first.config_hash == second.config_hash


def test_assumptions_are_a_field_and_the_trace_stays_pure_calculation(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert estimate.assumptions and all(text.endswith(".") for text in estimate.assumptions)
    assert not any("ssumption" in t.label for t in estimate.trace)
    assert estimate.totals_partial is False


def test_a_session_rate_override_replaces_that_role_only(
    drivers: EstimateDrivers, scope: list
) -> None:
    # Backend Engineer is 25% of the application mix: 10000 instead of 7600 adds 600.
    session = SessionConfig(
        rate_card_id="usd-standard",
        environments_count=2,
        rate_overrides=[RoleRate(role="Backend Engineer", rate_per_person_week=10000)],
    )
    config = build_config(session)
    assert (
        next(r for r in config.rate_card.rates if r.role == "QA Engineer").rate_per_person_week
        == 6400
    )  # type: ignore[union-attr]
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    assert _trace_result(_line(estimate, "WS_01"), "WS_01 blended rate (USD per person-week)") == (
        APPLICATION_RATE + 600
    )
    assert any(
        "Session rates replace" in a and "Backend Engineer" in a for a in estimate.assumptions
    )


def test_an_override_for_a_role_outside_the_mix_changes_nothing(
    drivers: EstimateDrivers, scope: list
) -> None:
    session = SessionConfig(
        rate_card_id="usd-standard",
        environments_count=2,
        rate_overrides=[RoleRate(role="Technical Writer", rate_per_person_week=1)],
    )
    estimate = calculate_estimate(drivers, scope, build_config(session), {}, now=NOW)
    assert (
        _trace_result(_line(estimate, "WS_01"), "WS_01 blended rate (USD per person-week)")
        == APPLICATION_RATE
    )
    assert not any("Session rates replace" in a for a in estimate.assumptions)


def test_a_workstream_listed_in_several_phases_is_scheduled_once(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    once = calculate_estimate(drivers, scope, config, {}, now=NOW)
    # The same build workstream now spans two phases instead of one.
    spanned = ("Experience and Core Platform", "Testing and Hardening")
    phases = [
        phase.model_copy(update={"workstream_ids": ["WS_01"]}) if phase.name in spanned else phase
        for phase in drivers.phases
    ]
    spread = calculate_estimate(
        drivers.model_copy(update={"phases": phases}), scope, config, {}, now=NOW
    )
    full = _trace_result(once, "WS_01 duration in 'Experience and Core Platform' (high)")
    for name in spanned:
        share = _trace_result(spread, f"WS_01 duration in '{name}' (high)")
        assert abs(share - full / 2) < 1e-9
    # The build is shared out, never added twice, so the timeline cannot grow.
    assert spread.timeline_weeks_high <= once.timeline_weeks_high
    assert spread.effort_high == once.effort_high
    assert spread.rom == once.rom
