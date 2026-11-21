"""Load and validate the visible rule tables and rate cards.

The seeded file `seeds/config/estimation_defaults.json` is the only place the
numbers live. This module turns it into `EstimationRules` and refuses a table
with a hole in it, because a hole would become a guess at calculation time.
"""

import json
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.core.errors import AppError
from app.domain.artifacts import Complexity
from app.domain.estimation import (
    BaseEffortEntry,
    CommercialDefaults,
    ConfidenceLevel,
    ConfidenceSignal,
    ConfidenceSpread,
    ConfidenceThreshold,
    EstimationConfig,
    EstimationRules,
    FactorEntry,
    FactorScope,
    HistoricalProjects,
    PhaseOverhead,
    ProductivityBounds,
    RateCard,
    ReportingRules,
    RoleMixEntry,
    RoundingRule,
    WorkstreamTypeRule,
)
from app.domain.scope import RoleRate, SessionConfig, TeamSizeEntry

SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds" / "config"
DEFAULTS_PATH = SEEDS_DIR / "estimation_defaults.json"
RATE_CARDS_PATH = SEEDS_DIR / "rate_cards.json"
HISTORICAL_PATH = SEEDS_DIR / "historical_projects.json"
COMMERCIAL_PATH = SEEDS_DIR / "commercial.json"


class EstimationRulesInvalid(AppError):
    """The seeded rule tables or rate cards cannot be used as they are."""

    status_code = 500
    problem_type = "https://tc-101.local/problems/estimation-rules-invalid"
    title = "Estimation Rules Invalid"


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EstimationRulesInvalid(f"cannot read {path.name}: {exc}") from exc
    if not isinstance(data, dict):
        raise EstimationRulesInvalid(f"{path.name} must contain a JSON object")
    return data


def parse_rules(data: dict[str, Any]) -> EstimationRules:
    """Build the rule tables from the seeded JSON, checking what the models cannot."""
    try:
        rules = EstimationRules(
            base_effort=[BaseEffortEntry(**row) for row in data["base_effort"]["entries"]],
            phase_overheads=[PhaseOverhead(**row) for row in data["overheads"]["entries"]],
            factors=[FactorEntry(**row) for row in data["factors"]["entries"]],
            factor_scope=[FactorScope(**row) for row in data["factor_scope"]["entries"]],
            # The table is written in percent because that is how a role mix is read.
            role_mix=[
                RoleMixEntry(
                    workstream_type=row["workstream_type"],
                    role=row["role"],
                    share=row["percent"] / 100,
                )
                for row in data["role_mix"]["entries"]
            ],
            team_sizes=[TeamSizeEntry(**row) for row in data["team_sizes"]["entries"]],
            spreads=[ConfidenceSpread(**row) for row in data["spreads"]["entries"]],
            rounding=[RoundingRule(**row) for row in data["rounding"]["entries"]],
            confidence_thresholds=[
                ConfidenceThreshold(**row) for row in data["confidence"]["entries"]
            ],
            low_when_gap_is_critical=data["confidence"]["low_when_gap_is_critical"],
            workstream_types=[
                WorkstreamTypeRule(**row) for row in data["workstream_types"]["entries"]
            ],
            productivity=ProductivityBounds(
                **{k: v for k, v in data["productivity"].items() if k != "note"}
            ),
            reporting=ReportingRules(**{k: v for k, v in data["reporting"].items() if k != "note"}),
        )
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise EstimationRulesInvalid(f"estimation_defaults.json is not usable: {exc}") from exc
    _check_rules(rules)
    return rules


def _check_rules(rules: EstimationRules) -> None:
    """Reject tables with holes; the engine must never fall back to a guess."""
    errors: list[str] = []

    keys = {(row.unit_type, row.variant) for row in rules.base_effort}
    for unit_type, variant in sorted(keys, key=lambda k: (k[0].value, k[1])):
        for complexity in Complexity:
            if rules.base_effort_for(unit_type, variant, complexity) is None:
                errors.append(f"base effort missing for {unit_type.value} {variant} {complexity}")

    for level in ConfidenceLevel:
        if rules.spread_for(level) is None:
            errors.append(f"spread missing for confidence {level.value}")
        if rules.rom_nearest_for(level) is None:
            errors.append(f"rounding missing for confidence {level.value}")

    for signal in ConfidenceSignal:
        if rules.threshold_for(signal) is None:
            errors.append(f"confidence threshold missing for {signal.value}")

    shares: dict[str, float] = {}
    for row in rules.role_mix:
        shares[row.workstream_type] = shares.get(row.workstream_type, 0.0) + row.share
    for workstream_type, total in shares.items():
        if abs(total - 1) > 0.0001:
            errors.append(f"role mix for {workstream_type} sums to {total * 100}%, not 100%")
        if rules.team_size_for(workstream_type) is None:
            errors.append(f"no team size for workstream type {workstream_type}")

    for overhead in rules.phase_overheads:
        if not overhead.id or not overhead.workstream_type:
            errors.append(f"overhead '{overhead.phase}' needs an id and a workstream type")
        elif not rules.role_mix_for(overhead.workstream_type):
            errors.append(f"no role mix for overhead type {overhead.workstream_type}")

    for typing_rule in rules.workstream_types:
        if not rules.role_mix_for(typing_rule.workstream_type):
            errors.append(f"no role mix for workstream type {typing_rule.workstream_type}")

    bounds = rules.productivity
    if not bounds.min <= bounds.default <= bounds.max:
        errors.append("productivity default is outside the bounds")

    if errors:
        raise EstimationRulesInvalid("estimation rule tables are incomplete", errors)


@lru_cache
def load_rules(path: Path = DEFAULTS_PATH) -> EstimationRules:
    return parse_rules(_read_json(path))


@lru_cache
def load_rate_cards(path: Path = RATE_CARDS_PATH) -> tuple[RateCard, ...]:
    data = _read_json(path)
    try:
        return tuple(RateCard(**row) for row in data["rate_cards"])
    except (KeyError, TypeError, ValidationError) as exc:
        raise EstimationRulesInvalid(f"rate_cards.json is not usable: {exc}") from exc


@lru_cache
def load_historical_projects(path: Path = HISTORICAL_PATH) -> HistoricalProjects:
    """Reference panel only; these numbers never enter a calculation."""
    try:
        return HistoricalProjects.model_validate(_read_json(path))
    except ValidationError as exc:
        raise EstimationRulesInvalid(f"historical_projects.json is not usable: {exc}") from exc


@lru_cache
def load_commercial_defaults(path: Path = COMMERCIAL_PATH) -> CommercialDefaults:
    try:
        return CommercialDefaults.model_validate(_read_json(path))
    except ValidationError as exc:
        raise EstimationRulesInvalid(f"commercial.json is not usable: {exc}") from exc


def with_commercial_defaults(config: SessionConfig) -> SessionConfig:
    """Fill what the creator left open from the seeded commercial defaults.

    Values the creator set are kept. The defaults stay visible: the rate card and the
    contingency both show in the estimate workspace and in the calculation trace.
    """
    defaults = load_commercial_defaults()
    given = config.model_fields_set
    updates: dict[str, Any] = {}
    if not config.rate_card_id:
        updates["rate_card_id"] = defaults.default_rate_card_id
    if "contingency_pct" not in given:
        updates["contingency_pct"] = defaults.default_contingency_pct
    if "blended_rate_mode" not in given:
        updates["blended_rate_mode"] = defaults.blended_rate_mode
    return config.model_copy(update=updates)


def select_rate_card(rate_card_id: str, cards: tuple[RateCard, ...]) -> RateCard | None:
    """The chosen card, or None so the engine can block the ROM lines."""
    for card in cards:
        if card.id == rate_card_id:
            return card
    return None


def apply_rate_overrides(card: RateCard | None, overrides: list[RoleRate]) -> RateCard | None:
    """The card as this session prices it: overridden roles replace the seeded rate.

    The seeded card is never changed; a role the card does not know is added, so a
    session can price a role the catalogue lacks.
    """
    if card is None or not overrides:
        return card
    by_role = {rate.role: rate for rate in card.rates}
    for override in overrides:
        by_role[override.role] = override
    return card.model_copy(update={"rates": list(by_role.values())})


def effective_team_sizes(
    rules: EstimationRules, overrides: list[TeamSizeEntry]
) -> list[TeamSizeEntry]:
    """Team size per workstream type as this session plans it: an override replaces the default.

    The seeded table is never changed; a type it does not know is added, so a session can
    size a workstream type the rules lack.
    """
    by_type = {row.workstream_type: row for row in rules.team_sizes}
    for override in overrides:
        by_type[override.workstream_type] = override
    return list(by_type.values())


def build_config(
    session_config: SessionConfig,
    *,
    rules: EstimationRules | None = None,
    rate_cards: tuple[RateCard, ...] | None = None,
) -> EstimationConfig:
    """Everything the engine needs: session inputs, the selected card, the rules."""
    cards = rate_cards if rate_cards is not None else load_rate_cards()
    card = select_rate_card(session_config.rate_card_id, cards)
    tables = rules if rules is not None else load_rules()
    return EstimationConfig(
        session_config=session_config,
        rate_card=apply_rate_overrides(card, session_config.rate_overrides),
        team_sizes=effective_team_sizes(tables, session_config.team_sizes),
        rules=tables,
    )


def config_hash(config: EstimationConfig) -> str:
    """Short stable hash of the inputs, so an estimate can be tied to its config."""
    payload = json.dumps(config.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return sha256(payload.encode("utf-8")).hexdigest()[:12]
