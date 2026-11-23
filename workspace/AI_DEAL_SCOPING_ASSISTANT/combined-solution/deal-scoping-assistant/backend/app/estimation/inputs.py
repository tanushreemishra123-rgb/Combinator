"""Step 8: what is missing, and every default the calculation leaned on.

Missing inputs are detected before step 2 because the confidence rules read
them; they are reported as step 8.
"""

from enum import Enum

from app.domain.artifacts import DriverWorkstream
from app.domain.estimation import EstimationConfig, MissingInput
from app.domain.scope import BlendedRateMode, SessionConfig
from app.estimation.confidence import ScopeIndex
from app.estimation.config import load_commercial_defaults
from app.estimation.lines import Line, Run

# Session inputs that carry a default; used ones are written out as assumptions.
_DEFAULTED_INPUTS = (
    "contingency_pct",
    "productivity_factor",
    "working_weeks_per_month",
    "environments_count",
    "security_level",
    "testing_level",
    "data_migration",
    "blended_rate_mode",
)


def detect_missing_inputs(
    session: SessionConfig, config: EstimationConfig, index: ScopeIndex, run: Run
) -> None:
    if config.rate_card is None:
        run.missing.append(
            MissingInput(
                key="rate_card_id",
                impact=(
                    "No rate card is selected, so no ROM line can be priced. Effort and "
                    "timeline are still calculated."
                ),
                affected_components=["rom"],
            )
        )
    if (
        session.blended_rate_mode is BlendedRateMode.EXPLICIT
        and session.explicit_blended_rate is None
    ):
        run.missing.append(
            MissingInput(
                key="explicit_blended_rate",
                impact="The rate mode is 'explicit' but no rate was entered, so ROM is blocked.",
                affected_components=["rom"],
            )
        )
    if session.expected_users is None and index.has_sizing_nfr():
        run.missing.append(
            MissingInput(
                key="expected_users",
                impact=(
                    "Scalability or performance requirements exist but the user volume is "
                    "unknown, so infrastructure sizing is unconfirmed and confidence is reduced."
                ),
                affected_components=["infrastructure lines", "confidence", "rom"],
            )
        )
    if session.delivery_deadline is None:
        run.missing.append(
            MissingInput(
                key="delivery_deadline",
                impact=(
                    "No delivery date was given, so the timeline is a range only and no "
                    "schedule risk is checked."
                ),
                affected_components=["timeline"],
            )
        )


def session_issues(run: Run, missing_keys: set[str], index: ScopeIndex, risk: str) -> list[str]:
    """Session-level reasons the overall confidence drops below the worst line."""
    issues = []
    if "expected_users" in missing_keys:
        issues.append(
            "Expected user volume is missing while scalability or performance requirements "
            "exist, so infrastructure effort is unconfirmed."
        )
    if risk:
        issues.append("The delivery deadline is earlier than the high end of the timeline.")
    if run.blocked:
        issues.append(
            f"Totals are partial. Lines that could not be calculated and are excluded: "
            f"{len(run.blocked)}."
        )
    return issues


def overall_limitations(lines: list[Line], issues: list[str]) -> list[str]:
    seen: list[str] = list(issues)
    for line in lines:
        for limitation in line.limitations:
            text = f"{line.name}: {limitation}"
            if text not in seen:
                seen.append(text)
    return seen


def _default_value(name: str) -> object:
    """The value an input carries when nobody set it: seeded for the commercial ones."""
    defaults = load_commercial_defaults()
    if name == "contingency_pct":
        return defaults.default_contingency_pct
    if name == "blended_rate_mode":
        return defaults.blended_rate_mode
    return SessionConfig.model_fields[name].default


def _shown(value: object) -> str:
    if isinstance(value, Enum):
        return str(value.value)
    return f"{value:g}%" if isinstance(value, float) else str(value)


def record_default_assumptions(session: SessionConfig, run: Run) -> None:
    """Every session default the engine leans on is written out as an assumption.

    The config is compared with the defaults by value, not by which fields were set:
    a session reloaded from the database has every field set, and the reader still
    needs to know which inputs are only defaults.
    """
    for name in _DEFAULTED_INPUTS:
        value = getattr(session, name)
        if value == _default_value(name):
            run.assume(f"{name} was not given; the default '{_shown(value)}' is used.")


def workstream_input_gaps(
    workstream: DriverWorkstream,
    index: ScopeIndex,
    missing_keys: set[str],
    workstream_type: str,
    excluded: list[str],
) -> list[str]:
    """Input gaps that belong to this line, on top of the scope-based signals."""
    gaps = []
    if "expected_users" in missing_keys and (
        workstream_type == "platform"
        or set(workstream.req_ids) & index.sizing_req_ids()
        or workstream.arc_ids
    ):
        gaps.append(
            "Expected user volume was not given, so the infrastructure sizing behind this "
            "line is unconfirmed."
        )
    if excluded:
        gaps.append("Some units in this line could not be priced from the visible rules.")
    return gaps
