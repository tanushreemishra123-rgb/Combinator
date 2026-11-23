"""Step 5: phases, how long each one takes, milestones and the deadline check.

Workstreams inside a phase run in parallel, so a phase lasts as long as its
longest workstream; phases themselves run one after the other. A workstream listed
in several phases spans them, so its duration is shared evenly between them.
"""

from datetime import date
from decimal import Decimal

from app.domain.artifacts import EstimateDrivers
from app.domain.estimation import (
    BlockedLine,
    EstimationConfig,
    EstimationRules,
    Milestone,
    MissingInput,
    PhaseEstimate,
    TraceEntry,
)
from app.estimation.lines import Line, Run, quantize
from app.estimation.trace import dec, entry


def build_timeline(
    drivers: EstimateDrivers,
    lines: list[Line],
    config: EstimationConfig,
    run: Run,
) -> list[PhaseEstimate]:
    rules = config.rules
    by_id = {line.id: line for line in lines}
    overheads = [line for line in lines if line.overhead]
    placed: set[str] = set()
    phases: list[PhaseEstimate] = []

    driver_phases = list(drivers.phases)
    if not driver_phases:
        run.missing.append(
            MissingInput(
                key="phases",
                impact=(
                    "The drivers list no delivery phases, so the whole scope is shown as one "
                    "phase and the timeline cannot be sequenced."
                ),
                affected_components=["timeline", "milestones"],
            )
        )

    # Counted per phase, not per listing, so a workstream is never scheduled twice.
    spans: dict[str, int] = {}
    for phase in driver_phases:
        for ws_id in set(phase.workstream_ids) & by_id.keys():
            spans[ws_id] = spans.get(ws_id, 0) + 1

    plan: list[tuple[str, list[Line], list[str]]] = []
    for phase in driver_phases:
        members = [by_id[ws_id] for ws_id in dict.fromkeys(phase.workstream_ids) if ws_id in by_id]
        for overhead in _overheads_for(phase.name, overheads, rules, placed):
            members.append(overhead)
            placed.add(overhead.id)
        plan.append((phase.name, members, list(phase.milestones)))
    if not driver_phases:
        plan.append(("Delivery", list(lines), []))
        placed.update(line.id for line in overheads)

    # An overhead line that matches no phase still has to appear in the timeline, in the
    # order work really happens: discovery before the build, testing and handover after it.
    leading = {rule.id for rule in rules.phase_overheads if rule.before_build}
    unplaced = [line for line in overheads if line.id not in placed]
    plan = (
        [(line.name, [line], []) for line in unplaced if line.id in leading]
        + plan
        + [(line.name, [line], []) for line in unplaced if line.id not in leading]
    )

    scheduled = {line.id for _, members, _ in plan for line in members}
    unscheduled = [line.id for line in lines if line.id not in scheduled]
    if unscheduled:
        run.missing.append(
            MissingInput(
                key="phases",
                impact="These workstreams are in no phase, so they are not in the timeline: "
                + ", ".join(unscheduled),
                affected_components=["timeline"],
            )
        )

    cumulative_low = Decimal(0)
    cumulative_high = Decimal(0)
    decimals = rules.reporting.timeline_weeks_decimals
    for name, members, milestone_names in plan:
        low, high, trace = _phase_weeks(name, members, spans, config, run)
        # Cumulative milestones use the shown phase durations, so the column adds up.
        low, high = quantize(low, decimals), quantize(high, decimals)
        cumulative_low += low
        cumulative_high += high
        run.trace.extend(trace)
        phases.append(
            PhaseEstimate(
                name=name,
                workstream_ids=[line.id for line in members],
                weeks_low=float(low),
                weeks_high=float(high),
                milestones=[
                    Milestone(
                        name=milestone,
                        phase=name,
                        week_low=float(cumulative_low),
                        week_high=float(cumulative_high),
                    )
                    for milestone in (milestone_names or [f"{name} complete"])
                ],
            )
        )
    return phases


def _overheads_for(
    phase_name: str, overheads: list[Line], rules: EstimationRules, placed: set[str]
) -> list[Line]:
    name = phase_name.lower()
    matched: list[Line] = []
    for rule in rules.phase_overheads:
        if rule.id in placed or not any(word in name for word in rule.phase_keywords):
            continue
        matched.extend(line for line in overheads if line.id == rule.id)
    return matched


def _phase_weeks(
    phase_name: str,
    members: list[Line],
    spans: dict[str, int],
    config: EstimationConfig,
    run: Run,
) -> tuple[Decimal, Decimal, list[TraceEntry]]:
    productivity = dec(config.session_config.productivity_factor)
    trace: list[TraceEntry] = []
    lows: dict[str, object] = {}
    highs: dict[str, object] = {}
    for line in members:
        team_size = _team_size(line.workstream_type, config, run)
        if team_size is None:
            run.blocked.append(
                BlockedLine(
                    label=f"Timeline for {line.id}",
                    reason=f"no team size for a '{line.workstream_type}' workstream",
                )
            )
            continue
        phase_count = Decimal(spans.get(line.id, 1))
        capacity = team_size * productivity * phase_count
        low = line.effort_low / capacity
        high = line.effort_high / capacity
        lows[f"weeks:{line.id}"] = low
        highs[f"weeks:{line.id}"] = high
        trace.append(
            entry(
                f"{line.id} duration in '{phase_name}' (high)",
                "workstream_weeks = effort / (team_size x productivity_factor x phases_spanned)",
                {
                    "effort": line.effort_high,
                    "team_size": team_size,
                    "productivity_factor": productivity,
                    "phases_spanned": phase_count,
                },
                high,
            )
        )
    # Workstreams in a phase run in parallel, so the phase lasts as long as its longest one.
    low_weeks = max((dec(v) for v in lows.values()), default=Decimal(0))
    high_weeks = max((dec(v) for v in highs.values()), default=Decimal(0))
    trace.append(
        entry(
            f"Phase '{phase_name}' duration (high)",
            "phase_weeks = max of workstream_weeks in the phase",
            highs,
            high_weeks,
        )
    )
    return low_weeks, high_weeks, trace


def _team_size(workstream_type: str, config: EstimationConfig, run: Run) -> Decimal | None:
    size = config.team_size_for(workstream_type)
    if size is None:
        return None
    # The reviewer can change any size, so the estimate says where the number came from.
    given = any(row.workstream_type == workstream_type for row in config.session_config.team_sizes)
    source = "set for this session" if given else "seeded default"
    run.assume(f"A team of {size:g} people is used for '{workstream_type}' work ({source}).")
    return dec(size)


def deadline_risk(deadline: date | None, timeline_high: Decimal, today: date) -> str:
    if deadline is None:
        return ""
    available = Decimal((deadline - today).days) / Decimal(7)
    if timeline_high <= available:
        return ""
    return (
        f"The high timeline is {timeline_high:.2f} weeks but only {available:.2f} weeks remain "
        f"until {deadline.isoformat()}. Scope, team size or the date has to move."
    )
