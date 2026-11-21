from datetime import datetime

import pytest
from pydantic import ValidationError

from app.domain.artifacts import (
    AiStrategy,
    AiUseCase,
    Architecture,
    ArchitectureArea,
    ArchitectureComponent,
    ArtifactEnvelope,
    ArtifactKind,
    ArtifactStatus,
    Basis,
    Capability,
    Complexity,
    DataDomain,
    DataStrategy,
    DeliveryPackage,
    DriverPhase,
    DriverWorkstream,
    EngagementModel,
    Environments,
    EstimateDrivers,
    EstimateUnit,
    ExecutiveSummary,
    Flow,
    FrameworkRecommendation,
    FunctionalScope,
    IntegrationArchitecture,
    IntegrationItem,
    Module,
    NarrativeSection,
    OutOfScopeItem,
    Persona,
    PlatformAlternative,
    PlatformRecommendation,
    Prd,
    PrdRequirement,
    ProcessingClass,
    ProviderOption,
    ProviderPlatformScope,
    RecommendedEnhancement,
    ScopeClass,
    Statement,
    SystemRef,
    TraceabilityEntry,
    UnitType,
    UserJourney,
    Workstream,
)
from app.domain.scope import (
    CloudPlatform,
    IntegrationDirection,
    IntegrationPattern,
    Priority,
)


def section(text: str) -> NarrativeSection:
    return NarrativeSection(text=text, basis=Basis.INFERRED, req_ids=["FR_01"], arc_ids=["ARC_01"])


def statement(text: str) -> Statement:
    return Statement(text=text, basis=Basis.CUSTOMER, req_ids=["FR_01"])


def capability() -> Capability:
    return Capability(
        id="CAP_01",
        name="Customer Onboarding",
        description="Guided onboarding and identity verification.",
        included_req_ids=["FR_01", "INT_01"],
        priority=Priority.HIGH,
        scope_class=ScopeClass.CUSTOMER_REQUESTED,
        basis=Basis.CUSTOMER,
    )


def component() -> ArchitectureComponent:
    return ArchitectureComponent(
        id="ARC_01",
        name="Managed relational database",
        area=ArchitectureArea.DATABASES_AND_STORAGE,
        cloud_service="Azure Database for PostgreSQL",
        purpose="Stores customer profiles.",
        supported_ids=["DATA_01", "NFR_03"],
        rationale="Managed PostgreSQL with automated backups.",
        basis=Basis.CUSTOMER,
    )


def integration() -> IntegrationItem:
    return IntegrationItem(
        id="IA_01",
        name="CRM sync",
        source_system="Portal",
        target_system="Salesforce",
        direction=IntegrationDirection.OUTBOUND,
        pattern=IntegrationPattern.API,
        auth_approach="OAuth 2.0 client credentials",
        error_handling="Dead-letter queue with alerting",
        retry_behavior="Exponential backoff, five attempts",
        monitoring="Per-endpoint latency and error metrics",
        sync_considerations="Near real-time, eventual consistency",
        req_ids=["INT_01"],
        basis=Basis.CUSTOMER,
    )


def test_architecture_areas_are_the_14_spec_areas() -> None:
    assert len(list(ArchitectureArea)) == 14
    assert ArchitectureArea.BACKUP_AND_DISASTER_RECOVERY.value == "backup_and_disaster_recovery"


def test_prd_round_trip() -> None:
    prd = Prd(
        overview="A customer portal.",
        business_problem="Manual onboarding is slow.",
        objectives=[statement("Reduce onboarding time")],
        personas=[
            Persona(name="Broker", description="Sells policies", basis=Basis.CUSTOMER, needs=["x"])
        ],
        user_journeys=[
            UserJourney(name="Onboard", actor="Broker", steps=["Fill form"], basis=Basis.CUSTOMER)
        ],
        functional_requirements=[
            PrdRequirement(
                req_id="FR_01",
                statement="The portal must let brokers register.",
                acceptance_conditions=["Registration completes in one session"],
                req_ids=["FR_01"],
                basis=Basis.CUSTOMER,
            )
        ],
        out_of_scope=[
            OutOfScopeItem(text="Mobile app", reason="Not requested", basis=Basis.INFERRED)
        ],
        traceability=[TraceabilityEntry(req_id="FR_01", sections=["functional_requirements"])],
    )
    assert Prd.model_validate(prd.model_dump()) == prd


def test_functional_scope_round_trip() -> None:
    scope = FunctionalScope(
        capabilities=[capability()],
        modules=[
            Module(id="MOD_01", name="Onboarding", capability_ids=["CAP_01"], basis=Basis.INFERRED)
        ],
        workstreams=[
            Workstream(
                id="WS_01", name="Experience", capability_ids=["CAP_01"], basis=Basis.INFERRED
            )
        ],
        delivery_packages=[
            DeliveryPackage(
                id="DP_01",
                name="Core",
                capability_ids=["CAP_01"],
                engagement_model=EngagementModel.DELIVERY_PACKAGE,
                basis=Basis.RECOMMENDED,
            )
        ],
        recommended_enhancements=[
            RecommendedEnhancement(
                id="ENH_01",
                description="Add self-service password reset",
                rationale="Cuts support load",
                related_req_ids=["FR_01"],
                basis=Basis.RECOMMENDED,
                validation_required=True,
                validation_reason="Recommended beyond the stated scope",
            )
        ],
    )
    assert FunctionalScope.model_validate(scope.model_dump()) == scope


def test_capability_needs_at_least_one_requirement() -> None:
    with pytest.raises(ValidationError, match="at least one requirement id"):
        Capability(
            id="CAP_02",
            name="Reporting",
            description="Dashboards",
            included_req_ids=[],
            priority=Priority.LOW,
            scope_class=ScopeClass.RECOMMENDED_ENHANCEMENT,
            basis=Basis.RECOMMENDED,
        )


def test_capability_mirrors_requirements_into_req_ids() -> None:
    assert capability().req_ids == ["FR_01", "INT_01"]


def test_architecture_round_trip() -> None:
    architecture = Architecture(
        platform=CloudPlatform.AZURE,
        platform_recommendation=PlatformRecommendation(
            recommended=CloudPlatform.AZURE,
            rationale="Existing Microsoft estate.",
            alternatives=[
                PlatformAlternative(platform=CloudPlatform.AWS, why_not="No existing use")
            ],
            basis=Basis.RECOMMENDED,
            req_ids=["TECH_01"],
        ),
        components=[component()],
        flows=[Flow(from_id="ARC_01", to_id="ARC_02", label="reads", protocol="TLS")],
        environments=Environments(dev="Shared", test="Isolated", prod="Multi-zone"),
        deployment_runtime=section("Containers on managed Kubernetes."),
        availability_scalability=section("Zone redundant, autoscaling."),
        backup_dr=section("Daily backups, cross-region restore."),
        observability=section("Central logs and traces."),
        security_controls=section("Private networking and managed identities."),
    )
    assert Architecture.model_validate(architecture.model_dump()) == architecture


def test_component_needs_supporting_ids() -> None:
    with pytest.raises(ValidationError, match="at least one requirement or assumption id"):
        ArchitectureComponent(
            id="ARC_09",
            name="Cache",
            area=ArchitectureArea.BACKEND_SERVICES,
            cloud_service="Azure Cache for Redis",
            purpose="Speeds up reads",
            supported_ids=[],
            rationale="Faster",
            basis=Basis.RECOMMENDED,
        )


def test_data_strategy_round_trip() -> None:
    strategy = DataStrategy(
        domains=[
            DataDomain(
                id="DOM_01",
                name="Customer",
                description="Customer master data",
                sources=["CRM"],
                owner="Sales ops",
                basis=Basis.CUSTOMER,
                req_ids=["DATA_01"],
            )
        ],
        ingestion=section("Batch load from CRM."),
        transactional_storage=section("Relational store."),
        analytical_storage=section("Warehouse."),
        quality=section("Validation rules."),
        metadata_governance=section("Catalog and ownership."),
        retention=section("Seven years."),
        privacy_security=section("Encryption at rest."),
        reporting_analytics=section("Operational dashboards."),
        backup_recovery=section("Point-in-time restore."),
    )
    assert DataStrategy.model_validate(strategy.model_dump()) == strategy


def test_integration_architecture_round_trip() -> None:
    architecture = IntegrationArchitecture(
        integrations=[integration()],
        internal_systems=[SystemRef(name="Portal", basis=Basis.CUSTOMER, req_ids=["FR_01"])],
        external_systems=[SystemRef(name="Salesforce", basis=Basis.CUSTOMER, req_ids=["INT_01"])],
        flows=[Flow(from_id="Portal", to_id="Salesforce", label="accounts")],
    )
    assert IntegrationArchitecture.model_validate(architecture.model_dump()) == architecture


def test_integration_needs_an_int_or_data_requirement() -> None:
    payload = integration().model_dump() | {"req_ids": ["FR_01"]}
    with pytest.raises(ValidationError, match="INT or DATA requirement"):
        IntegrationItem.model_validate(payload)


def test_ai_strategy_round_trip() -> None:
    strategy = AiStrategy(
        ai_requirements=[statement("Answers must cite the source document.")],
        use_cases=[
            AiUseCase(
                id="AI_01",
                name="Support answer drafting",
                description="Drafts answers from the knowledge base.",
                processing_class=ProcessingClass.AI,
                pattern="Retrieval-augmented generation",
                model_options=["gemini-2.5-flash"],
                retrieval_required=True,
                retrieval_notes="Vector search over the knowledge base.",
                orchestration="Single chain with structured output",
                prompt_and_structured_output="Versioned prompts, JSON schema output",
                evaluation="Golden set with weekly review",
                responsible_ai_safety="Refusal rules and escalation",
                monitoring_feedback="Agent thumbs up or down",
                human_review="Agent approves before sending",
                data_privacy="No customer PII in prompts",
                basis=Basis.INFERRED,
                req_ids=["FR_02"],
            )
        ],
        deterministic_areas=[statement("Entitlement checks stay rule based.")],
        mandatory_human_decisions=[statement("Refund approval stays with an agent.")],
        architecture_pattern="Retrieval-augmented generation with human review",
        provider_options=[
            ProviderOption(
                platform=ProviderPlatformScope.ANY,
                provider="Google",
                models=["gemini-2.5-flash"],
                rationale="Free tier covers the pilot volume.",
            )
        ],
        framework_recommendations=[
            FrameworkRecommendation(
                name="LangGraph",
                purpose="Stage orchestration with validation and repair",
                rationale="The scoping stages need a validate-and-repair loop.",
                alternatives_considered=["Custom orchestration"],
                basis=Basis.RECOMMENDED,
                req_ids=["FR_02"],
            )
        ],
    )
    assert AiStrategy.model_validate(strategy.model_dump()) == strategy


def test_estimate_drivers_round_trip() -> None:
    drivers = EstimateDrivers(
        units=[
            EstimateUnit(
                unit_id="CAP_01",
                unit_type=UnitType.CAPABILITY,
                workstream_id="WS_01",
                complexity=Complexity.HIGH,
                drivers=["Identity verification", "CRM integration"],
            )
        ],
        workstreams=[
            DriverWorkstream(
                id="WS_01",
                name="Experience and Core Platform",
                capability_ids=["CAP_01"],
                derived_complexity=Complexity.HIGH,
                roles=["Frontend Engineer", "Backend Engineer"],
                basis=Basis.INFERRED,
                req_ids=["FR_01"],
            )
        ],
        phases=[
            DriverPhase(name="Phase 1", workstream_ids=["WS_01"], milestones=["Design signed"])
        ],
        delivery_risks=[statement("External API readiness is unconfirmed.")],
        estimation_assumptions=[statement("One integration environment is available.")],
        exclusions=[statement("Licences and cloud consumption are excluded.")],
    )
    assert EstimateDrivers.model_validate(drivers.model_dump()) == drivers


def test_executive_summary_round_trip() -> None:
    summary = ExecutiveSummary(
        overview="A modernized portal on Azure.",
        customer_objectives=[statement("Cut onboarding time in half.")],
        solution_highlights=[statement("Reuses the existing CRM.")],
        commercial_summary="18 to 24 person-weeks, ROM 240k to 320k USD.",
        key_risks=[statement("Integration readiness is unconfirmed.")],
        next_steps=[statement("Confirm the open assumptions.")],
    )
    assert ExecutiveSummary.model_validate(summary.model_dump()) == summary


def test_artifact_envelope_round_trip() -> None:
    envelope = ArtifactEnvelope(
        kind=ArtifactKind.PRD,
        version=2,
        scope_version_used=3,
        config_hash_used="abc123",
        status=ArtifactStatus.STALE,
        stale_reasons=["expected_users changed"],
        generated_by="mock:recorded",
        created_at=datetime(2026, 9, 17),
        content={"overview": "A customer portal."},
    )
    assert ArtifactEnvelope.model_validate(envelope.model_dump()) == envelope
