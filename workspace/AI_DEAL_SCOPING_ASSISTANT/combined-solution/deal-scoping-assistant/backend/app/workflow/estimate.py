"""The deterministic estimate: build its config, calculate it, store it, edit its drivers."""

from sqlalchemy.orm import Session as DbSession

from app.artifacts import service as artifacts
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.db.models import Session as SessionRow
from app.domain.artifacts import ArtifactKind, EstimateDrivers, IntegrationArchitecture
from app.domain.changes import UnitComplexityOverride
from app.domain.estimation import Estimate, EstimationConfig, RateCard
from app.estimation import build_config, calculate_estimate, load_rate_cards
from app.scope.service import list_rows, to_domain
from app.workflow.context import session_config

CALCULATED_BY = "deterministic:estimation-engine"


def estimation_config(session: SessionRow) -> EstimationConfig:
    """Session inputs, the selected rate card and the seeded rule tables."""
    return build_config(session_config(session))


def rate_cards() -> list[RateCard]:
    return list(load_rate_cards())


def load_drivers(db: DbSession, session_id: str) -> EstimateDrivers:
    row = artifacts.get_row(db, session_id, ArtifactKind.ESTIMATE_DRIVERS)
    if row is None:
        raise Conflict(
            "The estimate needs its drivers. Generate them with "
            f"POST /api/v1/sessions/{session_id}/artifacts/estimate_drivers/generate."
        )
    return EstimateDrivers.model_validate(row.content)


def integration_patterns(db: DbSession, session_id: str) -> dict[str, str]:
    """Integration id to pattern, so the engine can price each integration unit."""
    row = artifacts.get_row(db, session_id, ArtifactKind.INTEGRATION_ARCHITECTURE)
    if row is None:
        return {}
    content = IntegrationArchitecture.model_validate(row.content)
    return {item.id: item.pattern.value for item in content.integrations}


def calculate(db: DbSession, session: SessionRow) -> Estimate:
    """Recalculate from the current drivers, scope and configuration, and store the result."""
    drivers = load_drivers(db, session.id)
    items = [to_domain(row) for row in list_rows(db, session.id)]
    estimate = calculate_estimate(
        drivers,
        items,
        estimation_config(session),
        integration_patterns(db, session.id),
    )
    artifacts.store(
        db, session, ArtifactKind.ESTIMATE, estimate.model_dump(mode="json"), CALCULATED_BY
    )
    _refresh_commercial_summary(db, session.id, estimate)
    return estimate


def _refresh_commercial_summary(db: DbSession, session_id: str, estimate: Estimate) -> None:
    """The summary's commercial paragraph is a copy of these numbers, so it follows them.

    Only that deterministic paragraph changes; the model-written text, version and status
    stay as they were, so a reviewed summary is never replaced.
    """
    row = artifacts.get_row(db, session_id, ArtifactKind.EXECUTIVE_SUMMARY)
    if row is None:
        return
    paragraph = commercial_summary(estimate)
    if row.content.get("commercial_summary") == paragraph:
        return
    row.content = {**row.content, "commercial_summary": paragraph}
    db.commit()


def get(db: DbSession, session_id: str) -> Estimate:
    estimate = artifacts.load_estimate(db, session_id)
    if estimate is None:
        raise NotFound("This session has no estimate yet. Calculate it first.")
    return estimate


def apply_unit_complexity(
    db: DbSession, session: SessionRow, overrides: list[UnitComplexityOverride]
) -> EstimateDrivers:
    """Store the reviewer's complexity ratings on the drivers; the estimate follows."""
    if not overrides:
        raise ValidationFailed("Send at least one unit complexity override.")
    drivers = load_drivers(db, session.id)
    known = {unit.unit_id for unit in drivers.units}
    unknown = [override.unit_id for override in overrides if override.unit_id not in known]
    if unknown:
        raise ValidationFailed(f"These units are not in the drivers: {', '.join(unknown)}.")
    chosen = {override.unit_id: override.complexity for override in overrides}
    for unit in drivers.units:
        if unit.unit_id in chosen:
            unit.complexity = chosen[unit.unit_id]
    row = artifacts.get_row(db, session.id, ArtifactKind.ESTIMATE_DRIVERS)
    generated_by = row.generated_by if row else ""
    artifacts.store(
        db,
        session,
        ArtifactKind.ESTIMATE_DRIVERS,
        drivers.model_dump(mode="json"),
        generated_by,
    )
    return drivers


def _money(value: float, currency: str) -> str:
    return f"{value:,.0f} {currency}".strip()


def commercial_summary(estimate: Estimate) -> str:
    """The paragraph the executive summary prints; it comes from the numbers, not the model."""
    parts = [
        f"Base effort {estimate.effort_low:g} to {estimate.effort_high:g} person-weeks",
        f"timeline {estimate.timeline_weeks_low:g} to {estimate.timeline_weeks_high:g} weeks",
    ]
    rom = estimate.rom
    if rom.currency and rom.amount_high > 0:
        low = _money(rom.amount_low, rom.currency)
        high = _money(rom.amount_high, rom.currency)
        parts.append(f"ROM {low} to {high} including {rom.contingency_pct:g}% contingency")
    else:
        parts.append("the ROM range is not priced because a commercial input is missing")
    parts.append(f"confidence {estimate.overall_confidence.value}")
    return ". ".join([", ".join(parts[:-1]), f"Overall {parts[-1]}."])
