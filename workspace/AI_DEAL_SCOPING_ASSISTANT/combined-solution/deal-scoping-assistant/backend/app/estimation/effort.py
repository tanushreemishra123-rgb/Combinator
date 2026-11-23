"""Steps 1 to 4: unit effort, factors, the confidence spread and the overheads.

Every number here comes from the seeded rule tables. A rule that is not there
blocks the unit and says so; it is never filled in with a guess.
"""

from collections import Counter
from decimal import Decimal

from app.domain.artifacts import (
    Complexity,
    DriverWorkstream,
    EstimateDrivers,
    EstimateUnit,
    UnitType,
)
from app.domain.estimation import BlockedLine, EstimationRules, FactorKind, TraceEntry
from app.domain.scope import SessionConfig
from app.estimation.confidence import ScopeIndex, assess_workstream, worst
from app.estimation.inputs import workstream_input_gaps
from app.estimation.lines import Line, Run, quantize, sum_decimals
from app.estimation.trace import dec, entry

_COMPLEXITY_ORDER = (Complexity.LOW, Complexity.MEDIUM, Complexity.HIGH, Complexity.VERY_HIGH)


class UnitNotEstimable(ValueError):
    """A unit cannot be priced from the visible rules; it becomes an error entry."""


# --- Step 1: unit effort -----------------------------------------------------


def _unit_effort(
    unit: EstimateUnit,
    rules: EstimationRules,
    session: SessionConfig,
    integration_patterns: dict[str, str],
) -> tuple[Decimal, list[TraceEntry]]:
    variant = ""
    if unit.unit_type is UnitType.INTEGRATION:
        variant = integration_patterns.get(unit.unit_id, "")
        if not variant:
            raise UnitNotEstimable(
                f"no integration pattern is known for {unit.unit_id}; "
                "api, event, batch or file is required to price it"
            )
    base_pw = rules.base_effort_for(unit.unit_type, variant, unit.complexity)
    if base_pw is None:
        label = f"{unit.unit_type.value} {variant}".strip()
        raise UnitNotEstimable(
            f"no base effort rule for {label} at complexity '{unit.complexity.value}'"
        )
    base = dec(base_pw)

    factors: dict[str, object] = {}
    product = Decimal(1)
    for kind, value in _factor_values(session).items():
        if not rules.factor_applies_to(kind, unit.unit_type):
            continue
        found = rules.factor_for(kind, value)
        if found is None:
            raise UnitNotEstimable(f"no {kind.value} factor rule for value '{value}'")
        multiplier = dec(found)
        factors[f"factor:{kind.value}={value}"] = multiplier
        product *= multiplier

    effort = base * product
    trace = [
        entry(
            f"{unit.unit_id} factor product",
            "factor_product = product of applicable factors",
            factors,
            product,
        ),
        entry(
            f"{unit.unit_id} effort ({unit.unit_type.value}, {unit.complexity.value})",
            "unit_effort = base_person_weeks x factor_product",
            {"base_person_weeks": base, "factor_product": product},
            effort,
        ),
    ]
    return effort, trace


def _factor_values(session: SessionConfig) -> dict[FactorKind, str]:
    count = session.environments_count
    return {
        FactorKind.SECURITY_LEVEL: session.security_level.value,
        FactorKind.TESTING_LEVEL: session.testing_level.value,
        FactorKind.ENVIRONMENTS: str(count) if count <= 4 else "5_or_more",
        FactorKind.DATA_MIGRATION: session.data_migration.value,
    }


# --- Steps 1 to 3: workstream lines -----------------------------------------


def build_lines(
    drivers: EstimateDrivers,
    index: ScopeIndex,
    rules: EstimationRules,
    session: SessionConfig,
    integration_patterns: dict[str, str],
    missing_keys: set[str],
    run: Run,
) -> list[Line]:
    known = {ws.id for ws in drivers.workstreams}
    units_by_ws: dict[str, list[EstimateUnit]] = {ws_id: [] for ws_id in known}
    for unit in drivers.units:
        if unit.workstream_id not in known:
            run.blocked.append(
                BlockedLine(
                    label=f"Unit {unit.unit_id}",
                    reason=(
                        f"it points at workstream '{unit.workstream_id}', which is not in the "
                        "drivers; the unit is excluded from the totals"
                    ),
                )
            )
            continue
        units_by_ws[unit.workstream_id].append(unit)

    lines = []
    for workstream in drivers.workstreams:
        lines.append(
            _workstream_line(
                workstream,
                units_by_ws[workstream.id],
                index,
                rules,
                session,
                integration_patterns,
                missing_keys,
                run,
            )
        )
    return lines


def _workstream_line(
    workstream: DriverWorkstream,
    units: list[EstimateUnit],
    index: ScopeIndex,
    rules: EstimationRules,
    session: SessionConfig,
    integration_patterns: dict[str, str],
    missing_keys: set[str],
    run: Run,
) -> Line:
    trace: list[TraceEntry] = []
    efforts: dict[str, object] = {}
    total = Decimal(0)
    excluded: list[str] = []

    for unit in units:
        try:
            effort, unit_trace = _unit_effort(unit, rules, session, integration_patterns)
        except UnitNotEstimable as exc:
            excluded.append(unit.unit_id)
            run.blocked.append(
                BlockedLine(label=f"Unit {unit.unit_id} ({workstream.id})", reason=str(exc))
            )
            continue
        trace.extend(unit_trace)
        efforts[f"unit:{unit.unit_id}"] = effort
        total += effort

    trace.append(
        entry(
            f"{workstream.id} build effort",
            "workstream_effort = sum of unit_effort",
            efforts,
            total,
        )
    )

    workstream_type = _workstream_type(units, rules, workstream, run)
    extra = workstream_input_gaps(workstream, index, missing_keys, workstream_type, excluded)
    assessment = assess_workstream(workstream, index, rules, extra)

    found_spread = rules.spread_for(assessment.level)
    if found_spread is None:  # cannot happen: the loader checks every level.
        raise UnitNotEstimable(f"no spread rule for confidence {assessment.level.value}")
    spread = dec(found_spread)
    low = total * (Decimal(1) - spread)
    high = total * (Decimal(1) + spread)
    trace.append(
        entry(
            f"{workstream.id} effort low",
            "effort_low = workstream_effort x (1 - spread_pct)",
            {"workstream_effort": total, "spread_pct": spread},
            low,
        )
    )
    trace.append(
        entry(
            f"{workstream.id} effort high",
            "effort_high = workstream_effort x (1 + spread_pct)",
            {"workstream_effort": total, "spread_pct": spread},
            high,
        )
    )

    blocked_reason = ""
    if excluded:
        blocked_reason = (
            "not fully calculable: " + ", ".join(excluded) + " could not be priced "
            "and are excluded from this line"
        )
    elif not units:
        blocked_reason = "no estimate units are linked to this workstream"
        run.blocked.append(BlockedLine(label=f"Workstream {workstream.id}", reason=blocked_reason))

    return Line(
        id=workstream.id,
        name=workstream.name,
        workstream_type=workstream_type,
        complexity=workstream.derived_complexity,
        req_ids=list(workstream.req_ids),
        roles=[row.role for row in rules.role_mix_for(workstream_type)],
        confidence=assessment.level,
        limitations=assessment.limitations,
        effort_low=quantize(low, rules.reporting.line_effort_decimals),
        effort_high=quantize(high, rules.reporting.line_effort_decimals),
        trace=trace,
        blocked=bool(blocked_reason),
        blocked_reason=blocked_reason,
    )


def _workstream_type(
    units: list[EstimateUnit],
    rules: EstimationRules,
    workstream: DriverWorkstream,
    run: Run,
) -> str:
    """The kind of unit that dominates the workstream decides team size and mix."""
    counts = Counter(unit.unit_type for unit in units)
    known = {kind: rules.workstream_type_for(kind) for kind in counts}
    typed = {kind: rule for kind, rule in known.items() if rule is not None}
    if not typed:
        for kind, rule in known.items():
            if rule is None:
                run.blocked.append(
                    BlockedLine(
                        label=f"Workstream {workstream.id}",
                        reason=f"no workstream type rule for a {kind.value} unit",
                    )
                )
        return ""
    top = max(typed, key=lambda kind: (counts[kind], -typed[kind].tie_break_rank))
    workstream_type = typed[top].workstream_type
    run.assume(
        f"{workstream.id} is priced as workstream type '{workstream_type}': "
        f"{top.value} is its leading unit kind ({counts[top]} of {sum(counts.values())} units)."
    )
    return workstream_type


# --- Step 4: overhead lines --------------------------------------------------


def overhead_lines(build: list[Line], rules: EstimationRules, run: Run) -> list[Line]:
    if not build:
        return []
    build_low = sum_decimals(line.effort_low for line in build)
    build_high = sum_decimals(line.effort_high for line in build)
    confidence = worst(line.confidence for line in build)
    complexity = max((line.complexity for line in build), key=_COMPLEXITY_ORDER.index)

    lines = []
    for overhead in rules.phase_overheads:
        pct = dec(overhead.pct_of_build)
        low = build_low * pct
        high = build_high * pct
        trace = [
            entry(
                f"{overhead.phase} effort low",
                "overhead_effort = build_effort x pct_of_build",
                {"build_effort": build_low, "pct_of_build": pct},
                low,
            ),
            entry(
                f"{overhead.phase} effort high",
                "overhead_effort = build_effort x pct_of_build",
                {"build_effort": build_high, "pct_of_build": pct},
                high,
            ),
        ]
        run.assume(
            f"{overhead.phase} is estimated at {pct * 100:.0f}% of the build effort (seeded rule)."
        )
        lines.append(
            Line(
                id=overhead.id,
                name=overhead.phase,
                workstream_type=overhead.workstream_type,
                complexity=complexity,
                req_ids=[],
                roles=[row.role for row in rules.role_mix_for(overhead.workstream_type)],
                confidence=confidence,
                limitations=["This line follows the build effort; it carries the same confidence."],
                effort_low=quantize(low, rules.reporting.line_effort_decimals),
                effort_high=quantize(high, rules.reporting.line_effort_decimals),
                trace=trace,
                overhead=True,
            )
        )
    return lines
