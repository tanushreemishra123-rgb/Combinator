"""cloud_catalog, architecture_areas, ai_completeness and asm_justification."""

from app.ai.findings import FindingLevel
from app.ai.validators.ai_completeness import check_ai_completeness
from app.ai.validators.architecture_areas import applicable_areas, check_architecture_areas
from app.ai.validators.asm_justification import check_asm_justification, traceable_assumption_ids
from app.ai.validators.cloud_catalog import check_cloud_catalog
from app.catalogs.cloud_services import load_cloud_catalog
from app.domain.artifacts import (
    AiStrategy,
    AiUseCase,
    ArchitectureArea,
    ArchitectureComponent,
    Basis,
    ProcessingClass,
)
from app.domain.scope import (
    AssumptionDetails,
    CloudPlatform,
    ConfirmationStatus,
    IntegrationDetails,
    IntegrationPattern,
    ItemStatus,
    ItemType,
    Origin,
    ScopeItemDetails,
)
from tests.unit.ai.conftest import make_item


class FakeArchitecture:
    """Only `components` is needed by these validators."""

    def __init__(self, components: list[ArchitectureComponent]) -> None:
        self.components = components


def component(service: str, area: ArchitectureArea, supported: list[str]) -> ArchitectureComponent:
    return ArchitectureComponent(
        id="ARC_01",
        name="Managed relational database",
        area=area,
        cloud_service=service,
        purpose="Stores policy data.",
        supported_ids=supported,
        rationale="Managed PostgreSQL.",
        basis=Basis.CUSTOMER,
    )


def test_catalog_service_is_accepted() -> None:
    catalog = load_cloud_catalog(CloudPlatform.AZURE)
    service = catalog.services[0].name
    architecture = FakeArchitecture(
        [component(service, ArchitectureArea.DATABASES_AND_STORAGE, ["FR_01"])]
    )
    assert check_cloud_catalog(architecture, catalog) == []


def test_service_outside_the_catalog_is_a_hard_error() -> None:
    catalog = load_cloud_catalog(CloudPlatform.AZURE)
    architecture = FakeArchitecture(
        [component("Amazon RDS", ArchitectureArea.DATABASES_AND_STORAGE, ["FR_01"])]
    )
    findings = check_cloud_catalog(architecture, catalog)
    assert findings[0].level is FindingLevel.ERROR
    assert "not a" in findings[0].message


def test_service_spelling_case_is_corrected() -> None:
    catalog = load_cloud_catalog(CloudPlatform.AWS)
    service = catalog.services[0].name
    architecture = FakeArchitecture(
        [component(service.upper(), ArchitectureArea.DATABASES_AND_STORAGE, ["FR_01"])]
    )
    assert check_cloud_catalog(architecture, catalog) == []
    assert architecture.components[0].cloud_service == service


def test_applicable_areas_depend_on_the_scope() -> None:
    plain = applicable_areas([make_item("FR_01")])
    assert ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING not in plain
    assert ArchitectureArea.AI_AND_ML_SERVICES not in plain
    eventful = applicable_areas(
        [
            make_item(
                "INT_01",
                ItemType.INTEGRATION,
                details=ScopeItemDetails(
                    integration=IntegrationDetails(
                        system="CRM", direction="inbound", pattern=IntegrationPattern.EVENT
                    )
                ),
            ),
            make_item("FR_02", tags=["ai"]),
        ]
    )
    assert ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING in eventful
    assert ArchitectureArea.AI_AND_ML_SERVICES in eventful


def test_missing_area_is_a_warning() -> None:
    architecture = FakeArchitecture(
        [component("Amazon RDS", ArchitectureArea.DATABASES_AND_STORAGE, ["FR_01"])]
    )
    assert check_architecture_areas(architecture, {ArchitectureArea.DATABASES_AND_STORAGE}) == []
    findings = check_architecture_areas(
        architecture, {ArchitectureArea.DATABASES_AND_STORAGE, ArchitectureArea.APIS}
    )
    assert findings[0].level is FindingLevel.WARNING
    assert "apis" in findings[0].message


def use_case(**kwargs: object) -> AiUseCase:
    fields: dict[str, object] = {
        "id": "AI_01",
        "name": "Answer support questions",
        "description": "Retrieval over the knowledge base.",
        "processing_class": ProcessingClass.AI,
        "pattern": "retrieval-augmented generation",
        "basis": Basis.RECOMMENDED,
        "req_ids": ["FR_01"],
        "evaluation": "Golden set per release.",
        "responsible_ai_safety": "Refusal rules and red teaming.",
        "data_privacy": "No personal data in prompts.",
        "human_review": "Agent approves every answer.",
    }
    fields.update(kwargs)
    return AiUseCase(**fields)  # type: ignore[arg-type]


def test_complete_use_case_passes() -> None:
    assert (
        check_ai_completeness(AiStrategy(use_cases=[use_case()], architecture_pattern="RAG")) == []
    )


def test_missing_responsible_ai_fields_is_an_error() -> None:
    strategy = AiStrategy(
        use_cases=[use_case(evaluation="", human_review="")], architecture_pattern="RAG"
    )
    findings = check_ai_completeness(strategy)
    assert "evaluation" in findings[0].message
    assert "human_review" in findings[0].message


def test_use_case_without_requirement_is_an_error() -> None:
    strategy = AiStrategy(use_cases=[use_case(req_ids=[])], architecture_pattern="RAG")
    assert any("requirement id" in f.message for f in check_ai_completeness(strategy))


def assumption(item_id: str, confirmation: ConfirmationStatus, **kwargs: object) -> object:
    return make_item(
        item_id,
        ItemType.ASSUMPTION,
        Origin.ASSUMED,
        source_refs=[],
        related_ids=kwargs.pop("related_ids", ["GAP_01"]),  # type: ignore[arg-type]
        details=ScopeItemDetails(assumption=AssumptionDetails(confirmation_status=confirmation)),
        **kwargs,
    )


def test_traceable_assumption_supports_a_component() -> None:
    items = [assumption("ASM_01", ConfirmationStatus.CONFIRMED)]
    architecture = FakeArchitecture(
        [component("Amazon RDS", ArchitectureArea.DATABASES_AND_STORAGE, ["ASM_01"])]
    )
    assert traceable_assumption_ids(items) == {"ASM_01"}
    assert check_asm_justification(architecture, items) == []


def test_rejected_assumption_cannot_support_a_component() -> None:
    items = [assumption("ASM_01", ConfirmationStatus.REJECTED)]
    architecture = FakeArchitecture(
        [component("Amazon RDS", ArchitectureArea.DATABASES_AND_STORAGE, ["ASM_01"])]
    )
    findings = check_asm_justification(architecture, items)
    assert findings[0].level is FindingLevel.ERROR
    assert traceable_assumption_ids(items) == set()


def test_rejected_item_status_also_blocks_the_assumption() -> None:
    items = [assumption("ASM_01", ConfirmationStatus.PENDING, status=ItemStatus.REJECTED)]
    assert traceable_assumption_ids(items) == set()


def test_pending_assumption_requires_validation() -> None:
    items = [assumption("ASM_01", ConfirmationStatus.PENDING)]
    architecture = FakeArchitecture(
        [component("Amazon RDS", ArchitectureArea.DATABASES_AND_STORAGE, ["ASM_01"])]
    )
    findings = check_asm_justification(architecture, items)
    assert findings[0].level is FindingLevel.WARNING
    assert "human validation" in findings[0].message


def test_functional_scope_must_carry_every_requirement() -> None:
    from app.ai.findings import FindingLevel
    from app.ai.validators.scope_coverage import check_scope_coverage
    from app.domain.artifacts import Basis, Capability, FunctionalScope, ScopeClass
    from app.domain.scope import Priority
    from tests.unit.ai.conftest import make_item

    items = [make_item("FR_01"), make_item("FR_02")]
    empty = FunctionalScope()
    assert "no capabilities" in check_scope_coverage(empty, items)[0].message

    partial_scope = FunctionalScope(
        capabilities=[
            Capability(
                id="CAP_01",
                name="Portal",
                description="x",
                included_req_ids=["FR_01"],
                priority=Priority.HIGH,
                module="",
                workstream_id="WS_01",
                delivery_package_id="DP_01",
                scope_class=ScopeClass.CUSTOMER_REQUESTED,
                basis=Basis.CUSTOMER,
            )
        ]
    )
    findings = check_scope_coverage(partial_scope, items)
    assert findings[0].ids == ["FR_02"] and findings[0].level is FindingLevel.ERROR
    assert (
        check_scope_coverage(partial_scope, items, FindingLevel.WARNING)[0].level
        is FindingLevel.WARNING
    )


def test_data_strategy_elements_must_name_a_requirement() -> None:
    from app.ai.findings import FindingLevel
    from app.ai.validators.grounding import check_grounding
    from app.domain.artifacts import Basis, DataDomain

    grounded = DataDomain(
        id="DOM_01",
        name="Policies",
        description="x",
        sources=[],
        owner="",
        req_ids=["DATA_01"],
        basis=Basis.CUSTOMER,
    )
    empty = DataDomain(
        id="DOM_02", name="Claims", description="x", sources=[], owner="", basis=Basis.CUSTOMER
    )
    findings = check_grounding([("DOM_01", grounded), ("DOM_02", empty), ("retention", empty)])
    assert findings and "DOM_02, retention" in findings[0].message
    assert findings[0].ids == ["DOM_02"]
    assert check_grounding([("DOM_01", grounded)], FindingLevel.WARNING) == []
