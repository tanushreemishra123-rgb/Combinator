"""The worked example in docs/ESTIMATION.md, number for number.

If this test changes, that document has to change with it.
"""

from app.domain.artifacts import EstimateDrivers
from app.domain.scope import SessionConfig
from app.estimation.config import build_config
from app.estimation.engine import calculate_estimate

from .conftest import NOW


def test_the_documented_example(drivers: EstimateDrivers, scope: list) -> None:
    config = build_config(SessionConfig(rate_card_id="usd-standard", environments_count=2))
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    lines = {line.workstream_id: line for line in estimate.workstreams}

    # Step 1: base effort, all factors 1.0 -> 3.0 + 6.0 = 9.0 person-weeks.
    build = next(t for t in lines["WS_01"].trace if t.label == "WS_01 build effort")
    assert build.result == 9.0

    # Steps 2 and 3: high confidence -> 10% spread.
    assert lines["WS_01"].confidence.value == "high"
    assert (lines["WS_01"].effort_low, lines["WS_01"].effort_high) == (8.1, 9.9)

    # Step 4: overheads at 12%, 18% and 8% of the build range.
    assert (lines["OVH_DISCOVERY"].effort_low, lines["OVH_DISCOVERY"].effort_high) == (0.97, 1.19)
    assert (lines["OVH_TESTING"].effort_low, lines["OVH_TESTING"].effort_high) == (1.46, 1.78)
    assert (lines["OVH_DEPLOYMENT"].effort_low, lines["OVH_DEPLOYMENT"].effort_high) == (
        0.65,
        0.79,
    )
    assert (estimate.effort_low, estimate.effort_high) == (11.0, 14.0)

    # Step 5: phase durations and the milestones at their ends.
    assert [(p.name, p.weeks_low, p.weeks_high) for p in estimate.phases] == [
        ("Discovery and Architecture", 0.3, 0.4),
        ("Experience and Core Platform", 1.6, 2.0),
        ("Testing and Hardening", 0.5, 0.6),
        ("Deployment and Handover", 0.3, 0.4),
    ]
    assert (estimate.timeline_weeks_low, estimate.timeline_weeks_high) == (2.7, 3.4)
    assert [(m.name, m.week_high) for p in estimate.phases for m in p.milestones] == [
        ("Architecture signed off", 0.4),
        ("Portal feature complete", 2.4),
        ("Test exit", 3.0),
        ("Go live", 3.4),
    ]

    # Step 6: blended rates from the role mix, contingency applied once.
    rates = {
        "WS_01": 7700.0,
        "OVH_DISCOVERY": 8720.0,
        "OVH_TESTING": 7300.0,
        "OVH_DEPLOYMENT": 8500.0,
    }
    for line_id, rate in rates.items():
        traced = next(t for t in lines[line_id].trace if "blended rate" in t.label)
        assert traced.result == rate
        rom_high = next(t for t in lines[line_id].trace if t.label == f"{line_id} ROM high")
        assert round(rom_high.result, 2) == round(lines[line_id].effort_high * rate * 1.15, 2)

    # Step 7: high confidence rounds the ROM to the nearest 1,000.
    totals = {t.label: t for t in estimate.trace if "ROM" in t.label}
    assert totals["Total ROM (high, before rounding)"].result == 122263.17
    low_rounding = totals["Total ROM low rounded for 'high' confidence"]
    assert next(i.value for i in low_rounding.inputs if i.name == "value") == "100063.11"
    assert estimate.overall_confidence.value == "high"
    assert (estimate.rom.amount_low, estimate.rom.amount_high) == (100000.0, 122000.0)
    assert estimate.rom.currency == "USD"
    assert (estimate.effort_incl_contingency_low, estimate.effort_incl_contingency_high) == (
        13.0,
        16.0,
    )

    # Step 8: the one input that is missing is named, and it blocks nothing.
    assert [m.key for m in estimate.missing_inputs] == ["delivery_deadline"]
    assert estimate.blocked_lines == []
