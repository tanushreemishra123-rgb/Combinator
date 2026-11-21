"""The seeded rule tables must be complete; a hole would become a guess."""

import json
from pathlib import Path

import pytest

from app.domain.artifacts import Complexity, UnitType
from app.domain.estimation import RateCard
from app.domain.scope import SessionConfig, TeamSizeEntry
from app.estimation.config import (
    DEFAULTS_PATH,
    EstimationRulesInvalid,
    build_config,
    config_hash,
    load_rate_cards,
    load_rules,
    parse_rules,
    select_rate_card,
)


def _raw() -> dict:
    return json.loads(Path(DEFAULTS_PATH).read_text(encoding="utf-8"))


def test_every_table_carries_a_note() -> None:
    raw = _raw()
    for key in (
        "base_effort",
        "overheads",
        "factors",
        "factor_scope",
        "spreads",
        "rounding",
        "reporting",
        "team_sizes",
        "role_mix",
        "productivity",
        "workstream_types",
        "confidence",
    ):
        assert raw[key]["note"].strip(), f"{key} has no note"


def test_base_effort_covers_every_unit_type_and_complexity() -> None:
    rules = load_rules()
    for unit_type in UnitType:
        variants = {row.variant for row in rules.base_effort if row.unit_type is unit_type}
        assert variants, f"no base effort for {unit_type}"
        for variant in variants:
            for complexity in Complexity:
                assert rules.base_effort_for(unit_type, variant, complexity) is not None


def test_integration_is_priced_by_pattern() -> None:
    rules = load_rules()
    patterns = {row.variant for row in rules.base_effort if row.unit_type is UnitType.INTEGRATION}
    assert patterns == {"api", "event", "batch", "file"}


def test_role_mix_sums_to_one_per_workstream_type() -> None:
    rules = load_rules()
    types = {row.workstream_type for row in rules.role_mix}
    for workstream_type in types:
        total = sum(row.share for row in rules.role_mix_for(workstream_type))
        assert round(total, 6) == 1.0


def test_role_mix_that_does_not_sum_to_100_is_rejected() -> None:
    raw = _raw()
    raw["role_mix"]["entries"][0]["percent"] = 99
    with pytest.raises(EstimationRulesInvalid) as exc:
        parse_rules(raw)
    assert "role mix" in str(exc.value.errors)


def test_a_hole_in_the_base_effort_table_is_rejected() -> None:
    raw = _raw()
    raw["base_effort"]["entries"] = raw["base_effort"]["entries"][1:]
    with pytest.raises(EstimationRulesInvalid) as exc:
        parse_rules(raw)
    assert "base effort missing" in str(exc.value.errors)


def test_an_unknown_rate_card_gives_no_card_at_all() -> None:
    cards = load_rate_cards()
    assert select_rate_card("nope", cards) is None
    assert build_config(SessionConfig(rate_card_id="nope")).rate_card is None


def test_both_seeded_cards_price_every_role_the_mix_uses() -> None:
    rules = load_rules()
    needed = {row.role for row in rules.role_mix}
    for card in load_rate_cards():
        assert needed <= {rate.role for rate in card.rates}


def test_config_hash_is_stable_and_input_sensitive() -> None:
    first = build_config(SessionConfig(rate_card_id="usd-standard"))
    same = build_config(SessionConfig(rate_card_id="usd-standard"))
    other = build_config(SessionConfig(rate_card_id="eur-standard"))
    assert config_hash(first) == config_hash(same)
    assert config_hash(first) != config_hash(other)


def test_rate_cards_are_loaded_as_the_shared_contract_model() -> None:
    assert all(isinstance(card, RateCard) for card in load_rate_cards())


def test_the_config_carries_one_team_size_per_workstream_type() -> None:
    rules = load_rules()
    config = build_config(SessionConfig(rate_card_id="usd-standard"))
    assert [row.workstream_type for row in config.team_sizes] == [
        row.workstream_type for row in rules.team_sizes
    ]
    assert all(
        config.team_size_for(row.workstream_type) == row.team_size for row in rules.team_sizes
    )


def test_a_session_team_size_replaces_that_workstream_type_only() -> None:
    session = SessionConfig(
        rate_card_id="usd-standard",
        team_sizes=[TeamSizeEntry(workstream_type="application", team_size=10)],
    )
    config = build_config(session)
    assert config.team_size_for("application") == 10
    assert config.team_size_for("testing") == load_rules().team_size_for("testing")
    assert len(config.team_sizes) == len(load_rules().team_sizes)
