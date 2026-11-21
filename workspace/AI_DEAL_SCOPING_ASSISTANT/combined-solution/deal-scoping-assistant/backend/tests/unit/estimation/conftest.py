"""Small builders so every estimation test starts from readable inputs."""

from datetime import UTC, datetime

import pytest

from app.domain.artifacts import (
    Basis,
    Complexity,
    DriverPhase,
    DriverWorkstream,
    EstimateDrivers,
    EstimateUnit,
    UnitType,
)
from app.domain.estimation import EstimationConfig, EstimationRules
from app.domain.scope import (
    AnswerStatus,
    AssumptionDetails,
    ConfirmationStatus,
    GapCriticality,
    GapDetails,
    ItemType,
    NfrCategory,
    NfrDetails,
    Origin,
    QuestionDetails,
    ScopeItem,
    ScopeItemDetails,
    SessionConfig,
    SourceRef,
)
from app.estimation.config import build_config, load_rules

NOW = datetime(2026, 1, 5, tzinfo=UTC)
SOURCE = [SourceRef(document_id="D1", segment_id="D1.S1", quote="customer text")]


def item(
    item_id: str,
    item_type: ItemType = ItemType.FUNCTIONAL_REQUIREMENT,
    origin: Origin = Origin.CUSTOMER_STATED,
    details: ScopeItemDetails | None = None,
    related_ids: list[str] | None = None,
) -> ScopeItem:
    return ScopeItem(
        id=item_id,
        type=item_type,
        title=item_id,
        origin=origin,
        source_refs=list(SOURCE),
        related_ids=related_ids or [],
        details=details or ScopeItemDetails(),
        created_at=NOW,
        updated_at=NOW,
    )


def nfr(item_id: str, category: NfrCategory = NfrCategory.SCALABILITY) -> ScopeItem:
    return item(
        item_id,
        ItemType.NON_FUNCTIONAL_REQUIREMENT,
        details=ScopeItemDetails(nfr=NfrDetails(category=category)),
    )


def open_question(item_id: str, affected: list[str]) -> ScopeItem:
    return item(
        item_id,
        ItemType.CLARIFICATION_QUESTION,
        details=ScopeItemDetails(
            question=QuestionDetails(affected_ids=affected, answer_status=AnswerStatus.OPEN)
        ),
    )


def pending_assumption(item_id: str, related: list[str]) -> ScopeItem:
    return item(
        item_id,
        ItemType.ASSUMPTION,
        origin=Origin.ASSUMED,
        related_ids=[*related, "GAP_01"],
        details=ScopeItemDetails(
            assumption=AssumptionDetails(confirmation_status=ConfirmationStatus.PENDING)
        ),
    )


def gap(
    item_id: str, areas: list[str], criticality: GapCriticality = GapCriticality.MEDIUM
) -> ScopeItem:
    return item(
        item_id,
        ItemType.MISSING_INFORMATION,
        details=ScopeItemDetails(gap=GapDetails(criticality=criticality, impacted_areas=areas)),
    )


def unit(
    unit_id: str,
    workstream_id: str = "WS_01",
    unit_type: UnitType = UnitType.CAPABILITY,
    complexity: Complexity = Complexity.MEDIUM,
) -> EstimateUnit:
    return EstimateUnit(
        unit_id=unit_id, unit_type=unit_type, workstream_id=workstream_id, complexity=complexity
    )


def workstream(
    workstream_id: str = "WS_01",
    name: str = "Customer Portal",
    req_ids: list[str] | None = None,
    complexity: Complexity = Complexity.HIGH,
    arc_ids: list[str] | None = None,
) -> DriverWorkstream:
    return DriverWorkstream(
        id=workstream_id,
        name=name,
        req_ids=req_ids if req_ids is not None else ["FR_01", "FR_02"],
        basis=Basis.CUSTOMER,
        derived_complexity=complexity,
        arc_ids=arc_ids or [],
    )


def phases() -> list[DriverPhase]:
    return [
        DriverPhase(name="Discovery and Architecture", milestones=["Architecture signed off"]),
        DriverPhase(
            name="Experience and Core Platform",
            workstream_ids=["WS_01"],
            milestones=["Portal feature complete"],
        ),
        DriverPhase(name="Testing and Hardening", milestones=["Test exit"]),
        DriverPhase(name="Deployment and Handover", milestones=["Go live"]),
    ]


@pytest.fixture
def rules() -> EstimationRules:
    return load_rules()


@pytest.fixture
def drivers() -> EstimateDrivers:
    """Two capabilities in one workstream: 3.0 + 6.0 = 9.0 person-weeks of build."""
    return EstimateDrivers(
        units=[
            unit("CAP_01", complexity=Complexity.MEDIUM),
            unit("CAP_02", complexity=Complexity.HIGH),
        ],
        workstreams=[workstream()],
        phases=phases(),
    )


@pytest.fixture
def scope() -> list[ScopeItem]:
    return [item("FR_01"), item("FR_02")]


@pytest.fixture
def session() -> SessionConfig:
    """Neutral inputs: every factor is 1.0, so the base table is visible in the result."""
    return SessionConfig(rate_card_id="usd-standard", environments_count=2)


@pytest.fixture
def config(session: SessionConfig) -> EstimationConfig:
    return build_config(session)
