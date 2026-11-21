"""Step 6: the blended rate, the contingency and the ROM range.

Contingency is applied exactly once, here. A line whose rate cannot be found is
blocked with the reason and left out of the total.
"""

from decimal import Decimal

from app.domain.estimation import (
    BlockedLine,
    EstimationConfig,
    EstimationRules,
    RomRange,
    TraceEntry,
)
from app.domain.scope import BlendedRateMode, SessionConfig
from app.estimation.lines import Line, Run, join_reasons, sum_decimals
from app.estimation.trace import dec, entry, round_to_nearest


def contingency_multiplier(session: SessionConfig) -> Decimal:
    """The only place the contingency percentage becomes a factor."""
    return Decimal(1) + dec(session.contingency_pct) / Decimal(100)


def price_lines(
    lines: list[Line], config: EstimationConfig, rules: EstimationRules, run: Run
) -> None:
    session = config.session_config
    contingency = dec(session.contingency_pct)
    multiplier = contingency_multiplier(session)
    for line in lines:
        rate, reason, rate_trace = _blended_rate(line, config, rules, run)
        line.trace.extend(rate_trace)
        if rate is None:
            line.blocked = True
            line.blocked_reason = join_reasons(line.blocked_reason, f"ROM blocked: {reason}")
            run.blocked.append(BlockedLine(label=f"ROM for {line.id} ({line.name})", reason=reason))
            continue
        line.rom_low = line.effort_low * rate * multiplier
        line.rom_high = line.effort_high * rate * multiplier
        for bound, effort, amount in (
            ("low", line.effort_low, line.rom_low),
            ("high", line.effort_high, line.rom_high),
        ):
            line.trace.append(
                entry(
                    f"{line.id} ROM {bound}",
                    "rom = effort x blended_rate x (1 + contingency_pct / 100)",
                    {
                        "effort": effort,
                        "blended_rate": rate,
                        "contingency_pct": contingency,
                    },
                    amount,
                )
            )


def _blended_rate(
    line: Line, config: EstimationConfig, rules: EstimationRules, run: Run
) -> tuple[Decimal | None, str, list[TraceEntry]]:
    session = config.session_config
    card = config.rate_card
    if card is None:
        return None, "no rate card is selected for this session, so no rate is available", []

    if session.blended_rate_mode is BlendedRateMode.EXPLICIT:
        if session.explicit_blended_rate is None:
            return None, "the blended rate mode is 'explicit' but no blended rate was entered", []
        return dec(session.explicit_blended_rate), "", []

    mix = rules.role_mix_for(line.workstream_type)
    if not mix:
        return None, f"no role mix is defined for a '{line.workstream_type}' workstream", []

    rates = {rate.role: dec(rate.rate_per_person_week) for rate in card.rates}
    missing_roles = [row.role for row in mix if row.role not in rates]
    if missing_roles:
        return (
            None,
            f"rate card '{card.id}' has no rate for " + ", ".join(sorted(missing_roles)),
            [],
        )

    inputs: dict[str, object] = {}
    total = Decimal(0)
    for row in mix:
        share = dec(row.share)
        inputs[f"share:{row.role}"] = share
        inputs[f"rate:{row.role}"] = rates[row.role]
        total += share * rates[row.role]
    run.assume(
        f"The blended rate for '{line.workstream_type}' work uses the seeded role mix of "
        f"{len(mix)} roles."
    )
    overridden = sorted(
        {override.role for override in session.rate_overrides} & {row.role for row in mix}
    )
    if overridden:
        run.assume(
            f"Session rates replace the '{card.id}' card rate for " + ", ".join(overridden) + "."
        )
    return (
        total,
        "",
        [
            entry(
                f"{line.id} blended rate ({card.currency} per person-week)",
                "blended_rate = sum of role_share x role_rate",
                inputs,
                total,
            )
        ],
    )


def rom_total(
    lines: list[Line],
    config: EstimationConfig,
    confidence: str,
    nearest: int,
    run: Run,
) -> RomRange:
    priced = [line for line in lines if line.rom_low is not None and line.rom_high is not None]
    low = sum_decimals(line.rom_low for line in priced if line.rom_low is not None)
    high = sum_decimals(line.rom_high for line in priced if line.rom_high is not None)
    run.trace.append(
        entry(
            "Total ROM (high, before rounding)",
            "total_rom = sum of line rom",
            {f"line:{line.id}": line.rom_high for line in priced if line.rom_high is not None},
            high,
        )
    )
    rounded_low = round_to_nearest(low, Decimal(nearest))
    rounded_high = round_to_nearest(high, Decimal(nearest))
    for bound, raw, rounded in (("low", low, rounded_low), ("high", high, rounded_high)):
        run.trace.append(
            entry(
                f"Total ROM {bound} rounded for '{confidence}' confidence",
                "rounded = nearest multiple of step",
                {"value": raw, "step": nearest},
                rounded,
            )
        )

    if not priced:
        basis = "blocked: no line could be priced"
    elif config.session_config.blended_rate_mode is BlendedRateMode.EXPLICIT:
        basis = "explicit blended rate per person-week"
    else:
        basis = "role mix per workstream type, weighted by the rate card"
    currency = config.rate_card.currency if config.rate_card else ""
    return RomRange(
        amount_low=float(rounded_low),
        amount_high=float(rounded_high),
        currency=currency,
        rate_basis=basis,
        contingency_pct=config.session_config.contingency_pct,
    )
