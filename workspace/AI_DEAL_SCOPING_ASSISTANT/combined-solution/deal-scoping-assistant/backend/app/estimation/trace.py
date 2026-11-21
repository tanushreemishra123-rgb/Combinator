"""Calculation trace: every number in an estimate carries the formula that made it.

A trace entry is a closed record: label, formula, the inputs used and the result.
The formula string doubles as the formula id, so `recompute` can run the same
maths again from the entry alone. Tests use that to prove a reviewer could
reproduce every line by hand.
"""

from collections.abc import Callable, Mapping
from decimal import Decimal

from app.domain.estimation import TraceEntry, TraceInput

# Two-decimal tolerance is enough: results are quantized before they are stored.
TOLERANCE = Decimal("0.01")


class UnknownFormulaError(ValueError):
    """Raised when a trace entry uses a formula that is not registered here."""


def dec(value: object) -> Decimal:
    """Decimal from anything we put in a trace; str() keeps float noise out."""
    return Decimal(str(value))


def _sum_prefixed(inputs: Mapping[str, str], prefix: str) -> Decimal:
    return sum((dec(v) for k, v in inputs.items() if k.startswith(prefix)), Decimal(0))


def _product_prefixed(inputs: Mapping[str, str], prefix: str) -> Decimal:
    result = Decimal(1)
    for key, value in inputs.items():
        if key.startswith(prefix):
            result *= dec(value)
    return result


def round_to_nearest(value: Decimal, nearest: Decimal) -> Decimal:
    # Decimal quantize would only give powers of ten; ROM rounds to 1000 or 5000.
    steps = (value / nearest).to_integral_value(rounding="ROUND_HALF_UP")
    return steps * nearest


# One named function per formula, so a reviewer can read the maths on its own.
def _factor_product(i: Mapping[str, str]) -> Decimal:
    return _product_prefixed(i, "factor:")


def _unit_effort(i: Mapping[str, str]) -> Decimal:
    return dec(i["base_person_weeks"]) * dec(i["factor_product"])


def _workstream_effort(i: Mapping[str, str]) -> Decimal:
    return _sum_prefixed(i, "unit:")


def _effort_low(i: Mapping[str, str]) -> Decimal:
    return dec(i["workstream_effort"]) * (Decimal(1) - dec(i["spread_pct"]))


def _effort_high(i: Mapping[str, str]) -> Decimal:
    return dec(i["workstream_effort"]) * (Decimal(1) + dec(i["spread_pct"]))


def _overhead_effort(i: Mapping[str, str]) -> Decimal:
    return dec(i["build_effort"]) * dec(i["pct_of_build"])


def _total_effort(i: Mapping[str, str]) -> Decimal:
    return _sum_prefixed(i, "line:")


def _effort_incl_contingency(i: Mapping[str, str]) -> Decimal:
    return dec(i["effort"]) * (Decimal(1) + dec(i["contingency_pct"]) / 100)


def _blended_rate(i: Mapping[str, str]) -> Decimal:
    shares = (
        dec(share) * dec(i[f"rate:{key.removeprefix('share:')}"])
        for key, share in i.items()
        if key.startswith("share:")
    )
    return sum(shares, Decimal(0))


def _rom(i: Mapping[str, str]) -> Decimal:
    contingency = Decimal(1) + dec(i["contingency_pct"]) / 100
    return dec(i["effort"]) * dec(i["blended_rate"]) * contingency


def _total_rom(i: Mapping[str, str]) -> Decimal:
    return _sum_prefixed(i, "line:")


def _workstream_weeks(i: Mapping[str, str]) -> Decimal:
    capacity = dec(i["team_size"]) * dec(i["productivity_factor"]) * dec(i["phases_spanned"])
    return dec(i["effort"]) / capacity


def _phase_weeks(i: Mapping[str, str]) -> Decimal:
    return max((dec(v) for k, v in i.items() if k.startswith("weeks:")), default=Decimal(0))


def _timeline_weeks(i: Mapping[str, str]) -> Decimal:
    return _sum_prefixed(i, "phase:")


def _rounded(i: Mapping[str, str]) -> Decimal:
    return round_to_nearest(dec(i["value"]), dec(i["step"]))


# Formula id -> the maths it stands for. The id is the human-readable formula.
FORMULAS: dict[str, Callable[[Mapping[str, str]], Decimal]] = {
    "factor_product = product of applicable factors": _factor_product,
    "unit_effort = base_person_weeks x factor_product": _unit_effort,
    "workstream_effort = sum of unit_effort": _workstream_effort,
    "effort_low = workstream_effort x (1 - spread_pct)": _effort_low,
    "effort_high = workstream_effort x (1 + spread_pct)": _effort_high,
    "overhead_effort = build_effort x pct_of_build": _overhead_effort,
    "total_effort = sum of line effort": _total_effort,
    "effort_incl_contingency = effort x (1 + contingency_pct / 100)": _effort_incl_contingency,
    "blended_rate = sum of role_share x role_rate": _blended_rate,
    "rom = effort x blended_rate x (1 + contingency_pct / 100)": _rom,
    "total_rom = sum of line rom": _total_rom,
    "workstream_weeks = effort / (team_size x productivity_factor x phases_spanned)": (
        _workstream_weeks
    ),
    "phase_weeks = max of workstream_weeks in the phase": _phase_weeks,
    "timeline_weeks = sum of phase_weeks": _timeline_weeks,
    "rounded = nearest multiple of step": _rounded,
}


def show(value: object) -> str:
    """Trace values a human reads: no trailing zeros, no scientific notation."""
    if isinstance(value, Decimal):
        trimmed = value.normalize()
        if trimmed == trimmed.to_integral_value():
            trimmed = trimmed.quantize(Decimal(1))
        return format(trimmed, "f")
    return str(value)


def entry(label: str, formula: str, inputs: Mapping[str, object], result: Decimal) -> TraceEntry:
    """Build a trace entry; refuses a formula nobody can recompute."""
    if formula not in FORMULAS:
        raise UnknownFormulaError(f"formula not registered: {formula}")
    return TraceEntry(
        label=label,
        formula=formula,
        inputs=[TraceInput(name=name, value=show(value)) for name, value in inputs.items()],
        result=float(result),
    )


def recompute(trace_entry: TraceEntry) -> Decimal:
    """Run the entry's formula again over its own inputs."""
    formula = FORMULAS.get(trace_entry.formula)
    if formula is None:
        raise UnknownFormulaError(f"formula not registered: {trace_entry.formula}")
    return formula({i.name: i.value for i in trace_entry.inputs})


def reproduces(trace_entry: TraceEntry) -> bool:
    """True when recomputing the entry lands on the stored result."""
    return abs(recompute(trace_entry) - dec(trace_entry.result)) <= TOLERANCE
