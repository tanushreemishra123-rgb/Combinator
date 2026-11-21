from datetime import datetime

import pytest
from pydantic import ValidationError

from app.domain.scope import (
    AssumptionDetails,
    GapCriticality,
    GapDetails,
    ItemType,
    NfrCategory,
    NfrDetails,
    Origin,
    ScopeItem,
    ScopeItemCreate,
    ScopeItemDetails,
    SessionConfig,
    SourceRef,
    UpdatedBy,
)

REF = SourceRef(document_id="D1", segment_id="D1.S3", quote="Users must log in", verified=True)


def test_item_prefixes_cover_the_15_types() -> None:
    prefixes = {item.value for item in ItemType}
    assert len(prefixes) == 15
    assert {"BR", "FR", "NFR", "INT", "DATA", "SEC", "GAP", "ASM", "Q"} <= prefixes


def test_customer_stated_item_round_trips() -> None:
    item = ScopeItem(
        id="FR_01",
        type=ItemType.FUNCTIONAL_REQUIREMENT,
        title="Login",
        origin=Origin.CUSTOMER_STATED,
        source_refs=[REF],
        created_at=datetime(2026, 9, 17),
        updated_at=datetime(2026, 9, 17),
    )
    assert ScopeItem.model_validate(item.model_dump()) == item


def _ai_item(**fields: object) -> ScopeItem:
    now = datetime(2026, 9, 17)
    return ScopeItem(id="X_01", created_at=now, updated_at=now, **fields)  # type: ignore[arg-type]


def test_ai_customer_stated_item_needs_a_source_ref() -> None:
    with pytest.raises(ValidationError, match="source reference"):
        _ai_item(type=ItemType.FUNCTIONAL_REQUIREMENT, title="Login", origin=Origin.CUSTOMER_STATED)


def test_user_typed_item_needs_no_source_ref() -> None:
    # A reviewer can add something the customer said on a call; there is no document quote.
    item = ScopeItemCreate(
        type=ItemType.FUNCTIONAL_REQUIREMENT, title="Login", origin=Origin.CUSTOMER_STATED
    )
    assert item.grounding_errors() == ["customer_stated items need at least one source reference"]
    stored = _ai_item(**item.model_dump(), updated_by=UpdatedBy.USER)
    assert stored.updated_by is UpdatedBy.USER


def test_ai_gap_without_source_needs_absence_note() -> None:
    details = ScopeItemDetails(gap=GapDetails(criticality=GapCriticality.HIGH))
    fields = {
        "type": ItemType.MISSING_INFORMATION,
        "title": "No volume figures",
        "origin": Origin.ASSUMED,
        "related_ids": ["Q_01"],
        "details": details,
    }
    with pytest.raises(ValidationError, match="absence_note"):
        _ai_item(**fields)
    item = _ai_item(**fields, absence_note="not mentioned in the customer input")
    assert item.details.gap is not None


def test_ai_assumed_item_must_link_to_gap_or_question() -> None:
    details = ScopeItemDetails(assumption=AssumptionDetails(impact_if_wrong="rework"))
    fields = {
        "type": ItemType.ASSUMPTION,
        "title": "PostgreSQL is approved",
        "origin": Origin.ASSUMED,
        "details": details,
    }
    with pytest.raises(ValidationError, match="GAP or Q"):
        _ai_item(**fields)
    assert _ai_item(**fields, related_ids=["GAP_01"]).related_ids == ["GAP_01"]


def test_type_specific_details_are_required() -> None:
    with pytest.raises(ValidationError, match="details.nfr"):
        ScopeItemCreate(
            type=ItemType.NON_FUNCTIONAL_REQUIREMENT,
            title="99.9% uptime",
            origin=Origin.CUSTOMER_STATED,
            source_refs=[REF],
        )
    assert ScopeItemCreate(
        type=ItemType.NON_FUNCTIONAL_REQUIREMENT,
        title="99.9% uptime",
        origin=Origin.CUSTOMER_STATED,
        source_refs=[REF],
        details=ScopeItemDetails(nfr=NfrDetails(category=NfrCategory.AVAILABILITY)),
    )


def test_session_config_bounds() -> None:
    assert SessionConfig().contingency_pct == 15.0  # a percentage, 15 means 15%
    with pytest.raises(ValidationError):
        SessionConfig(productivity_factor=2.0)
    with pytest.raises(ValidationError):
        SessionConfig(contingency_pct=150)


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        SessionConfig(unexpected="x")  # type: ignore[call-arg]
