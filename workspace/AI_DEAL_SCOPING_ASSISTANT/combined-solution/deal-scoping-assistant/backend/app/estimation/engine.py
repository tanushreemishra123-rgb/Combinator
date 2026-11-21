"""The deterministic estimate: same inputs, same numbers, every number traced.

`calculate_estimate` walks the eight steps of `docs/ESTIMATION.md` in order:
unit effort, confidence, range, overhead, timeline, contingency and ROM, overall
confidence and rounding, missing inputs. Each step lives in its own module;
nothing here decides a number on its own.
"""

from collections.abc import Sequence
from datetime import UTC, datetime

from app.domain.artifacts import EstimateDrivers
from app.domain.estimation import Estimate, EstimationConfig, WorkstreamEstimate
from app.domain.scope import ScopeItem
from app.estimation.commercials import contingency_multiplier, price_lines, rom_total
from app.estimation.confidence import ScopeIndex, assess_overall
from app.estimation.config import config_hash
from app.estimation.effort import build_lines, overhead_lines
from app.estimation.inputs import (
    detect_missing_inputs,
    overall_limitations,
    record_default_assumptions,
    session_issues,
)
from app.estimation.lines import Line, Run, round_effort, sum_decimals
from app.estimation.timeline import build_timeline, deadline_risk
from app.estimation.trace import dec, entry


def calculate_estimate(
    drivers: EstimateDrivers,
    scope_items: Sequence[ScopeItem],
    config: EstimationConfig,
    integration_patterns: dict[str, str],
    *,
    now: datetime | None = None,
) -> Estimate:
    """Calculate the estimate. `now` is injectable so results stay reproducible."""
    rules = config.rules
    session = config.session_config
    index = ScopeIndex(scope_items)
    run = Run()
    moment = now or datetime.now(UTC)

    record_default_assumptions(session, run)
    detect_missing_inputs(session, config, index, run)
    missing_keys = {item.key for item in run.missing}

    lines = build_lines(drivers, index, rules, session, integration_patterns, missing_keys, run)
    build = [line for line in lines if not line.overhead]
    lines.extend(overhead_lines(build, rules, run))

    phases = build_timeline(drivers, lines, config, run)
    timeline_low = sum_decimals(p.weeks_low for p in phases)
    timeline_high = sum_decimals(p.weeks_high for p in phases)
    run.trace.append(
        entry(
            "Total timeline",
            "timeline_weeks = sum of phase_weeks",
            {f"phase:{p.name}": p.weeks_high for p in phases},
            timeline_high,
        )
    )

    price_lines(lines, config, rules, run)

    risk = deadline_risk(session.delivery_deadline, timeline_high, moment.date())
    issues = session_issues(run, missing_keys, index, risk)
    overall = assess_overall([line.confidence for line in lines], issues)

    effort_low = sum_decimals(line.effort_low for line in lines)
    effort_high = sum_decimals(line.effort_high for line in lines)
    nearest = rules.rom_nearest_for(overall.level) or 1000
    contingency = dec(session.contingency_pct)

    run.trace.append(
        entry(
            "Total base effort (high)",
            "total_effort = sum of line effort",
            {f"line:{line.id}": line.effort_high for line in lines},
            effort_high,
        )
    )
    incl_low = effort_low * contingency_multiplier(session)
    incl_high = effort_high * contingency_multiplier(session)
    run.trace.append(
        entry(
            "Effort including contingency (information only, high)",
            "effort_incl_contingency = effort x (1 + contingency_pct / 100)",
            {"effort": effort_high, "contingency_pct": contingency},
            incl_high,
        )
    )

    rom = rom_total(lines, config, overall.level.value, nearest, run)

    return Estimate(
        workstreams=[_to_output(line) for line in lines],
        phases=phases,
        effort_low=float(round_effort(effort_low)),
        effort_high=float(round_effort(effort_high)),
        effort_incl_contingency_low=float(round_effort(incl_low)),
        effort_incl_contingency_high=float(round_effort(incl_high)),
        timeline_weeks_low=float(timeline_low),
        timeline_weeks_high=float(timeline_high),
        rom=rom,
        overall_confidence=overall.level,
        confidence_limitations=overall_limitations(lines, overall.limitations),
        missing_inputs=run.missing,
        assumptions=run.assumptions,
        totals_partial=bool(run.blocked),
        blocked_lines=run.blocked,
        deadline_risk=risk,
        rate_card_id=config.rate_card.id if config.rate_card else "",
        config_hash=config_hash(config),
        trace=run.trace,
        calculated_at=moment,
    )


def _to_output(line: Line) -> WorkstreamEstimate:
    return WorkstreamEstimate(
        workstream_id=line.id,
        name=line.name,
        req_ids=line.req_ids,
        roles=line.roles,
        complexity=line.complexity,
        effort_low=float(line.effort_low),
        effort_high=float(line.effort_high),
        confidence=line.confidence,
        limitations=line.limitations,
        blocked=line.blocked,
        blocked_reason=line.blocked_reason,
        overhead=line.overhead,
        trace=line.trace,
    )
