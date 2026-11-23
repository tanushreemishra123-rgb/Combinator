"""The two records the calculation steps pass to each other, and their rounding.

Plain data: a `Line` is one estimate line while it is being built, a `Run`
collects what the whole calculation found on the way.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from app.domain.artifacts import Complexity
from app.domain.estimation import BlockedLine, ConfidenceLevel, MissingInput, TraceEntry
from app.estimation.trace import dec


@dataclass
class Line:
    """One estimate line while it is being built."""

    id: str
    name: str
    workstream_type: str
    complexity: Complexity
    req_ids: list[str]
    roles: list[str]
    confidence: ConfidenceLevel
    limitations: list[str]
    effort_low: Decimal
    effort_high: Decimal
    trace: list[TraceEntry]
    overhead: bool = False
    blocked: bool = False
    blocked_reason: str = ""
    rom_low: Decimal | None = None
    rom_high: Decimal | None = None


@dataclass
class Run:
    """Everything collected while the estimate is calculated."""

    blocked: list[BlockedLine] = field(default_factory=list)
    missing: list[MissingInput] = field(default_factory=list)
    trace: list[TraceEntry] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)

    def assume(self, sentence: str) -> None:
        """Record a default the calculation leaned on, once."""
        if sentence not in self.assumptions:
            self.assumptions.append(sentence)


def join_reasons(existing: str, extra: str) -> str:
    return f"{existing}; {extra}" if existing else extra


def sum_decimals(values: Iterable[Decimal | float]) -> Decimal:
    return sum((dec(v) for v in values), Decimal(0))


def quantize(value: Decimal, decimals: int) -> Decimal:
    return value.quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)


def round_effort(value: Decimal) -> Decimal:
    """Totals are reported in whole person-weeks; the lines keep their decimals."""
    return value.quantize(Decimal(1), rounding=ROUND_HALF_UP)
