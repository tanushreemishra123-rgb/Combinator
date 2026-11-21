"""Every number must be recomputable by hand from its own trace entry."""

import pytest

from app.domain.artifacts import Complexity, EstimateDrivers, UnitType
from app.domain.estimation import Estimate, EstimationConfig, TraceEntry, TraceInput
from app.domain.scope import SessionConfig
from app.estimation.config import build_config
from app.estimation.engine import calculate_estimate
from app.estimation.trace import FORMULAS, UnknownFormulaError, entry, recompute, reproduces

from .conftest import NOW, item, phases, unit, workstream


def _all_entries(estimate: Estimate) -> list[TraceEntry]:
    return [*estimate.trace, *(t for line in estimate.workstreams for t in line.trace)]


def _rich_estimate() -> Estimate:
    drivers = EstimateDrivers(
        units=[
            unit("CAP_01", "WS_01", UnitType.CAPABILITY, Complexity.MEDIUM),
            unit("IA_01", "WS_02", UnitType.INTEGRATION, Complexity.HIGH),
            unit("DOM_01", "WS_02", UnitType.DATA_DOMAIN, Complexity.LOW),
            unit("AI_01", "WS_03", UnitType.AI_USE_CASE, Complexity.VERY_HIGH),
        ],
        workstreams=[
            workstream(),
            workstream("WS_02", "Data and Integration", req_ids=["FR_01"]),
            workstream("WS_03", "AI Capabilities", req_ids=["FR_02"]),
        ],
        phases=phases(),
    )
    config = build_config(SessionConfig(rate_card_id="usd-standard", environments_count=3))
    return calculate_estimate(
        drivers, [item("FR_01"), item("FR_02")], config, {"IA_01": "api"}, now=NOW
    )


def test_every_trace_entry_reproduces_its_result() -> None:
    estimate = _rich_estimate()
    failures = [t.label for t in _all_entries(estimate) if not reproduces(t)]
    assert failures == []


def test_a_blocked_estimate_still_traces_what_it_could_calculate(
    drivers: EstimateDrivers, scope: list
) -> None:
    estimate = calculate_estimate(
        drivers, scope, build_config(SessionConfig()), {}, now=NOW
    )  # no rate card
    assert [t.label for t in _all_entries(estimate) if not reproduces(t)] == []


def test_the_engine_uses_every_registered_formula() -> None:
    used = {t.formula for t in _all_entries(_rich_estimate())}
    assert used == set(FORMULAS), f"unused or unknown formulas: {used ^ set(FORMULAS)}"


def test_a_reviewer_can_recompute_a_line_by_hand(
    drivers: EstimateDrivers, scope: list, config: EstimationConfig
) -> None:
    estimate = calculate_estimate(drivers, scope, config, {}, now=NOW)
    rom = next(t for t in estimate.workstreams[0].trace if t.label == "WS_01 ROM high")
    inputs = {i.name: i.value for i in rom.inputs}
    assert inputs == {
        "effort": "9.9",
        "blended_rate": "7700",
        "contingency_pct": "15",
    }
    assert float(recompute(rom)) == rom.result == 9.9 * 7700 * 1.15


def test_an_unregistered_formula_is_refused() -> None:
    with pytest.raises(UnknownFormulaError):
        entry("made up", "rom = effort x vibes", {}, __import__("decimal").Decimal(1))
    with pytest.raises(UnknownFormulaError):
        recompute(TraceEntry(label="x", formula="not a formula", inputs=[], result=1.0))


def test_recompute_reads_only_the_entry() -> None:
    handmade = TraceEntry(
        label="two capabilities",
        formula="workstream_effort = sum of unit_effort",
        inputs=[
            TraceInput(name="unit:CAP_01", value="3.0"),
            TraceInput(name="unit:CAP_02", value="6.0"),
        ],
        result=9.0,
    )
    assert float(recompute(handmade)) == 9.0
    assert reproduces(handmade)
