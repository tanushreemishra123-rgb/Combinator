"""One small but complete and consistent session, used by the WP4 unit tests.

Every artifact is built from the domain models and then dumped, so the fixture
cannot drift from the contracts. Tests break a copy of it to force a finding.
"""

from datetime import UTC, date, datetime
from typing import Any

from app.change_impact.models import SessionState
from app.domain.artifacts import (
    AiStrategy,
    AiUseCase,
    Architecture,
    ArchitectureArea,
    ArchitectureComponent,
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
from app.domain.estimation import (
    ConfidenceLevel,
    Estimate,
    PhaseEstimate,
    RateCard,
    RoleRate,
    RomRange,
    WorkstreamEstimate,
)
from app.domain.scope import (
    AiProviderPreference,
    AnswerStatus,
    AssumptionDetails,
    CloudPlatform,
    ConfirmationStatus,
    GapCriticality,
    GapDetails,
    IntegrationDetails,
    IntegrationDirection,
    IntegrationPattern,
    ItemStatus,
    ItemType,
    NfrCategory,
    NfrDetails,
    Origin,
    Priority,
    QuestionDetails,
    ScopeItem,
    ScopeItemDetails,
    SecurityLevel,
    SessionConfig,
    SourceRef,
)
from app.quality.checks import QualityContext
from app.quality.service import REQUIRED_ARTIFACT_KINDS, build_context

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=UTC)
SESSION_ID = "SES_01"
SCOPE_VERSION = 2
CONFIG_HASH = "cfg-1"

AZURE_SERVICES = frozenset(
    {
        "Azure Static Web Apps",
        "Azure App Service",
        "Azure SQL Database",
        "Microsoft Defender for Cloud",
        "Azure API Management",
        "Azure OpenAI Service",
        "Azure Front Door",
        "Microsoft Entra ID",
    }
)


def _ref(segment: str = "D1.S1", quote: str = "customer text") -> SourceRef:
    return SourceRef(
        document_id="DOC_01", segment_id=segment, quote=quote, start=0, end=13, verified=True
    )


def _item(
    item_id: str,
    item_type: ItemType,
    title: str,
    origin: Origin = Origin.CUSTOMER_STATED,
    priority: Priority = Priority.MEDIUM,
    tags: list[str] | None = None,
    related_ids: list[str] | None = None,
    details: ScopeItemDetails | None = None,
    absence_note: str = "",
) -> ScopeItem:
    needs_ref = origin in (Origin.CUSTOMER_STATED, Origin.AI_INFERRED)
    return ScopeItem(
        id=item_id,
        type=item_type,
        title=title,
        description=f"{title}.",
        priority=priority,
        origin=origin,
        status=ItemStatus.APPROVED,
        source_refs=[_ref()] if needs_ref else [],
        related_ids=related_ids or [],
        tags=tags or [],
        absence_note=absence_note,
        details=details or ScopeItemDetails(),
        created_at=NOW,
        updated_at=NOW,
    )


def scope_items() -> list[ScopeItem]:
    """15 items across the scope categories, all reviewed and approved."""
    return [
        _item(
            "BR_01", ItemType.BUSINESS_OBJECTIVE, "Cut policy handling time", priority=Priority.MUST
        ),
        _item("PER_01", ItemType.PERSONA, "Policy administrator"),
        _item(
            "FR_01",
            ItemType.FUNCTIONAL_REQUIREMENT,
            "Guided customer onboarding",
            priority=Priority.MUST,
        ),
        _item(
            "FR_02",
            ItemType.FUNCTIONAL_REQUIREMENT,
            "Self-service policy portal",
            priority=Priority.HIGH,
        ),
        _item(
            "FR_03",
            ItemType.FUNCTIONAL_REQUIREMENT,
            "Support knowledge assistant",
            origin=Origin.AI_INFERRED,
            priority=Priority.HIGH,
            tags=["ai"],
        ),
        _item(
            "NFR_01",
            ItemType.NON_FUNCTIONAL_REQUIREMENT,
            "Handle 50,000 active users",
            priority=Priority.HIGH,
            tags=["scalability"],
            details=ScopeItemDetails(nfr=NfrDetails(category=NfrCategory.SCALABILITY)),
        ),
        _item(
            "NFR_02",
            ItemType.NON_FUNCTIONAL_REQUIREMENT,
            "Portal pages load in two seconds",
            origin=Origin.AI_INFERRED,
            tags=["performance"],
            details=ScopeItemDetails(nfr=NfrDetails(category=NfrCategory.PERFORMANCE)),
        ),
        _item(
            "INT_01",
            ItemType.INTEGRATION,
            "CRM customer synchronisation",
            priority=Priority.MUST,
            details=ScopeItemDetails(
                integration=IntegrationDetails(
                    system="Salesforce CRM",
                    direction=IntegrationDirection.BIDIRECTIONAL,
                    pattern=IntegrationPattern.API,
                )
            ),
        ),
        _item(
            "DATA_01",
            ItemType.DATA_REQUIREMENT,
            "Customer and policy master data",
            priority=Priority.HIGH,
        ),
        _item(
            "SEC_01",
            ItemType.SECURITY_COMPLIANCE,
            "GDPR compliant personal data handling",
            priority=Priority.MUST,
            tags=["security"],
        ),
        _item("TECH_01", ItemType.TECHNOLOGY_PREFERENCE, "Existing Azure tenant should be used"),
        _item(
            "RISK_01",
            ItemType.RISK,
            "Legacy policy logic is undocumented",
            origin=Origin.AI_INFERRED,
        ),
        _item(
            "GAP_01",
            ItemType.MISSING_INFORMATION,
            "Peak transaction volume is not stated",
            origin=Origin.AI_INFERRED,
            priority=Priority.HIGH,
            related_ids=["Q_01"],
            details=ScopeItemDetails(
                gap=GapDetails(
                    criticality=GapCriticality.HIGH,
                    impacted_areas=["scalability"],
                    question_id="Q_01",
                    assumption_id="ASM_01",
                )
            ),
        ),
        _item(
            "Q_01",
            ItemType.CLARIFICATION_QUESTION,
            "What peak transaction volume must the portal carry?",
            origin=Origin.AI_INFERRED,
            priority=Priority.HIGH,
            related_ids=["GAP_01", "NFR_01"],
            details=ScopeItemDetails(
                question=QuestionDetails(
                    why_it_matters="It drives the scalability design and the infra effort.",
                    affected_ids=["NFR_01"],
                    answer_status=AnswerStatus.ANSWERED,
                    answer="Peak is 900 transactions per minute.",
                )
            ),
        ),
        _item(
            "ASM_01",
            ItemType.ASSUMPTION,
            "Customer provides CRM API access in week one",
            origin=Origin.ASSUMED,
            related_ids=["GAP_01"],
            details=ScopeItemDetails(
                assumption=AssumptionDetails(
                    requires_confirmation=True,
                    confirmation_status=ConfirmationStatus.CONFIRMED,
                    impact_if_wrong="The CRM integration slips by at least two weeks.",
                )
            ),
        ),
    ]


def _prd() -> Prd:
    return Prd(
        overview="A modern policy administration portal with an AI support assistant.",
        business_problem="Policy handling is manual and slow.",
        objectives=[
            Statement(
                text="Cut policy handling time by half.", basis=Basis.CUSTOMER, req_ids=["BR_01"]
            )
        ],
        personas=[
            Persona(
                name="Policy administrator",
                description="Handles policy changes daily.",
                needs=["Fast search", "Fewer manual steps"],
                basis=Basis.CUSTOMER,
                req_ids=["PER_01"],
            )
        ],
        user_journeys=[
            UserJourney(
                name="Onboard a customer",
                actor="Policy administrator",
                steps=["Open onboarding", "Verify identity", "Sync to CRM"],
                basis=Basis.CUSTOMER,
                req_ids=["FR_01", "INT_01"],
            )
        ],
        functional_requirements=[
            PrdRequirement(
                req_id=req_id,
                statement=f"The solution shall deliver {req_id}.",
                acceptance_conditions=["Reviewed by the customer"],
                basis=Basis.CUSTOMER,
                req_ids=[req_id],
            )
            for req_id in ("FR_01", "FR_02", "FR_03")
        ],
        non_functional_requirements=[
            PrdRequirement(
                req_id=req_id,
                statement=f"The solution shall meet {req_id}.",
                acceptance_conditions=["Measured in performance testing"],
                basis=Basis.CUSTOMER,
                req_ids=[req_id],
            )
            for req_id in ("NFR_01", "NFR_02")
        ],
        integrations=[
            Statement(
                text="Bidirectional CRM synchronisation.", basis=Basis.CUSTOMER, req_ids=["INT_01"]
            )
        ],
        dependencies=[Statement(text="CRM API access.", basis=Basis.CUSTOMER, req_ids=["INT_01"])],
        assumptions=[
            Statement(
                text="CRM API access arrives in week one.", basis=Basis.ASSUMED, req_ids=["ASM_01"]
            )
        ],
        risks=[
            Statement(
                text="Legacy policy logic is undocumented.",
                basis=Basis.INFERRED,
                req_ids=["RISK_01"],
            )
        ],
        out_of_scope=[
            OutOfScopeItem(
                text="Migration of archived policies.",
                reason="The customer keeps the archive in place.",
                basis=Basis.CUSTOMER,
                req_ids=["DATA_01"],
            )
        ],
        open_questions=[
            Statement(text="Peak transaction volume.", basis=Basis.INFERRED, req_ids=["Q_01"])
        ],
        traceability=[
            TraceabilityEntry(
                req_id="FR_01", sections=["Functional requirements", "User journeys"]
            ),
            TraceabilityEntry(req_id="SEC_01", sections=["Non-functional requirements"]),
            TraceabilityEntry(req_id="DATA_01", sections=["Out of scope"]),
        ],
    )


def _functional_scope() -> FunctionalScope:
    return FunctionalScope(
        capabilities=[
            Capability(
                id="CAP_01",
                name="Customer onboarding",
                description="Guided onboarding with CRM synchronisation.",
                included_req_ids=["FR_01", "INT_01"],
                priority=Priority.MUST,
                module="MOD_01",
                workstream_id="WS_01",
                delivery_package_id="DP_01",
                scope_class=ScopeClass.CUSTOMER_REQUESTED,
                basis=Basis.CUSTOMER,
            ),
            Capability(
                id="CAP_02",
                name="Self-service portal",
                description="Policy self-service for customers.",
                included_req_ids=["FR_02", "NFR_02"],
                priority=Priority.HIGH,
                module="MOD_01",
                workstream_id="WS_01",
                delivery_package_id="DP_01",
                scope_class=ScopeClass.CUSTOMER_REQUESTED,
                basis=Basis.CUSTOMER,
            ),
            Capability(
                id="CAP_03",
                name="Support knowledge assistant",
                description="Retrieval-based answers for support agents.",
                included_req_ids=["FR_03"],
                priority=Priority.HIGH,
                module="MOD_01",
                workstream_id="WS_02",
                delivery_package_id="DP_01",
                scope_class=ScopeClass.AI_INTERPRETED,
                basis=Basis.INFERRED,
            ),
            Capability(
                id="CAP_04",
                name="Data and compliance foundation",
                description="Master data, retention and GDPR controls.",
                included_req_ids=["DATA_01", "SEC_01", "NFR_01"],
                priority=Priority.MUST,
                module="MOD_01",
                workstream_id="WS_03",
                delivery_package_id="DP_01",
                scope_class=ScopeClass.CUSTOMER_REQUESTED,
                basis=Basis.CUSTOMER,
            ),
        ],
        modules=[
            Module(
                id="MOD_01",
                name="Policy platform",
                description="All delivered capabilities.",
                capability_ids=["CAP_01", "CAP_02", "CAP_03", "CAP_04"],
                basis=Basis.INFERRED,
            )
        ],
        workstreams=[
            Workstream(
                id="WS_01",
                name="Onboarding and portal",
                capability_ids=["CAP_01", "CAP_02"],
                basis=Basis.INFERRED,
            ),
            Workstream(
                id="WS_02",
                name="Knowledge assistant",
                capability_ids=["CAP_03"],
                basis=Basis.INFERRED,
            ),
            Workstream(
                id="WS_03",
                name="Data and compliance",
                capability_ids=["CAP_04"],
                basis=Basis.INFERRED,
            ),
        ],
        delivery_packages=[
            DeliveryPackage(
                id="DP_01",
                name="Policy platform release one",
                capability_ids=["CAP_01", "CAP_02", "CAP_03", "CAP_04"],
                engagement_model=EngagementModel.BLENDED,
                basis=Basis.RECOMMENDED,
            )
        ],
        out_of_scope=[
            OutOfScopeItem(
                text="Mobile application.",
                reason="Not requested by the customer.",
                basis=Basis.CUSTOMER,
                req_ids=["FR_02"],
            )
        ],
        recommended_enhancements=[
            RecommendedEnhancement(
                id="ENH_01",
                description="Add proactive renewal reminders.",
                rationale="Reduces churn on top of the requested portal.",
                related_req_ids=["FR_02"],
                basis=Basis.RECOMMENDED,
            )
        ],
    )


_COMPONENTS: tuple[tuple[str, str, ArchitectureArea, str, list[str]], ...] = (
    (
        "ARC_01",
        "Customer portal front end",
        ArchitectureArea.USER_FACING_APPLICATIONS,
        "Azure Static Web Apps",
        ["FR_02"],
    ),
    (
        "ARC_02",
        "Policy services",
        ArchitectureArea.BACKEND_SERVICES,
        "Azure App Service",
        ["FR_01", "FR_02"],
    ),
    (
        "ARC_03",
        "Policy data store",
        ArchitectureArea.DATABASES_AND_STORAGE,
        "Azure SQL Database",
        ["DATA_01"],
    ),
    (
        "ARC_04",
        "Security monitoring",
        ArchitectureArea.SECURITY_CONTROLS,
        "Microsoft Defender for Cloud",
        ["SEC_01"],
    ),
    (
        "ARC_05",
        "Integration gateway",
        ArchitectureArea.INTEGRATION_COMPONENTS,
        "Azure API Management",
        ["INT_01"],
    ),
    (
        "ARC_06",
        "Assistant model service",
        ArchitectureArea.AI_AND_ML_SERVICES,
        "Azure OpenAI Service",
        ["FR_03", "ASM_01"],
    ),
    (
        "ARC_07",
        "Edge and scaling",
        ArchitectureArea.AVAILABILITY_AND_SCALABILITY,
        "Azure Front Door",
        ["NFR_01", "NFR_02"],
    ),
    (
        "ARC_08",
        "Identity",
        ArchitectureArea.IDENTITY_AND_ACCESS_MANAGEMENT,
        "Microsoft Entra ID",
        ["SEC_01"],
    ),
)


def _architecture() -> Architecture:
    return Architecture(
        platform=CloudPlatform.AZURE,
        components=[
            ArchitectureComponent(
                id=component_id,
                name=name,
                area=area,
                cloud_service=service,
                purpose=f"{name} for the policy platform.",
                supported_ids=supported,
                rationale="Managed service already used by the customer tenant.",
                trade_offs=["Vendor managed, less control"],
                security_considerations="Private networking and managed identities.",
                environments=["dev", "test", "prod"],
                basis=Basis.CUSTOMER,
                req_ids=supported,
            )
            for component_id, name, area, service, supported in _COMPONENTS
        ],
        flows=[
            Flow(from_id="ARC_01", to_id="ARC_02", label="Portal requests", protocol="HTTPS REST"),
            Flow(from_id="ARC_02", to_id="ARC_03", label="Policy reads and writes", protocol="TDS"),
            Flow(
                from_id="ARC_02", to_id="ARC_05", label="CRM synchronisation", protocol="HTTPS REST"
            ),
        ],
        environments=Environments(
            dev="Shared dev", test="Isolated test", prod="Zone redundant production"
        ),
        deployment_runtime=NarrativeSection(
            text="Infrastructure as code pipelines per environment.",
            basis=Basis.RECOMMENDED,
            arc_ids=["ARC_02"],
            req_ids=["FR_01"],
        ),
        availability_scalability=NarrativeSection(
            text="Auto scaling behind the edge service.",
            basis=Basis.CUSTOMER,
            arc_ids=["ARC_07"],
            req_ids=["NFR_01"],
        ),
        backup_dr=NarrativeSection(
            text="Point in time restore with geo redundant backups.",
            basis=Basis.RECOMMENDED,
            arc_ids=["ARC_03"],
            req_ids=["DATA_01"],
        ),
        observability=NarrativeSection(
            text="Central logs, metrics and alerts.",
            basis=Basis.RECOMMENDED,
            arc_ids=["ARC_02"],
            req_ids=["NFR_02"],
        ),
        security_controls=NarrativeSection(
            text="Least privilege access and data encryption.",
            basis=Basis.CUSTOMER,
            arc_ids=["ARC_04", "ARC_08"],
            req_ids=["SEC_01"],
        ),
    )


def _section(text: str, req_ids: list[str], arc_ids: list[str]) -> NarrativeSection:
    return NarrativeSection(text=text, basis=Basis.CUSTOMER, req_ids=req_ids, arc_ids=arc_ids)


def _data_strategy() -> DataStrategy:
    return DataStrategy(
        domains=[
            DataDomain(
                id="DOM_01",
                name="Customer and policy",
                description="Customer master data and policy records.",
                sources=["Legacy policy system", "Salesforce CRM"],
                owner="Operations",
                basis=Basis.CUSTOMER,
                req_ids=["DATA_01"],
            )
        ],
        ingestion=_section(
            "Batch load from the legacy system, then API updates.", ["DATA_01"], ["ARC_05"]
        ),
        transactional_storage=_section(
            "Relational store for policy records.", ["DATA_01"], ["ARC_03"]
        ),
        analytical_storage=_section("Reporting copy refreshed nightly.", ["DATA_01"], ["ARC_03"]),
        quality=_section(
            "Validation rules on ingest and reconciliation reports.", ["DATA_01"], ["ARC_03"]
        ),
        metadata_governance=_section(
            "Data owners and a business glossary.", ["DATA_01"], ["ARC_03"]
        ),
        retention=_section("Policies kept for ten years, then deleted.", ["SEC_01"], ["ARC_03"]),
        privacy_security=_section(
            "Personal data encrypted and access logged.", ["SEC_01"], ["ARC_04"]
        ),
        reporting_analytics=_section(
            "Operational dashboards for policy handling.", ["BR_01"], ["ARC_03"]
        ),
        backup_recovery=_section("Daily backups with tested restores.", ["DATA_01"], ["ARC_03"]),
    )


def _integration_architecture() -> IntegrationArchitecture:
    return IntegrationArchitecture(
        integrations=[
            IntegrationItem(
                id="IA_01",
                name="CRM customer synchronisation",
                source_system="Policy platform",
                target_system="Salesforce CRM",
                direction=IntegrationDirection.BIDIRECTIONAL,
                pattern=IntegrationPattern.API,
                auth_approach="OAuth 2.0 client credentials",
                error_handling="Dead letter queue with alerting",
                retry_behavior="Three retries with exponential backoff",
                monitoring="Gateway metrics and failure alerts",
                sync_considerations="Customer record is mastered in the CRM.",
                arc_ids=["ARC_05"],
                basis=Basis.CUSTOMER,
                req_ids=["INT_01"],
            )
        ],
        internal_systems=[
            SystemRef(
                name="Policy platform",
                description="The new solution.",
                basis=Basis.CUSTOMER,
                req_ids=["FR_01"],
            )
        ],
        external_systems=[
            SystemRef(
                name="Salesforce CRM",
                description="Customer system of record.",
                basis=Basis.CUSTOMER,
                req_ids=["INT_01"],
            )
        ],
        flows=[
            Flow(
                from_id="Policy platform",
                to_id="Salesforce CRM",
                label="Customer records",
                protocol="HTTPS REST",
            )
        ],
    )


def _ai_strategy() -> AiStrategy:
    return AiStrategy(
        ai_requirements=[
            Statement(
                text="Answers must cite the source document.",
                basis=Basis.INFERRED,
                req_ids=["FR_03"],
            )
        ],
        use_cases=[
            AiUseCase(
                id="AI_01",
                name="Support knowledge assistant",
                description="Answers agent questions from policy documents.",
                processing_class=ProcessingClass.AI,
                pattern="Retrieval-augmented generation",
                model_options=["Azure OpenAI GPT-4o mini"],
                retrieval_required=True,
                retrieval_notes="Vector search over approved policy documents.",
                orchestration="Single chain with a retrieval step.",
                prompt_and_structured_output="Templated prompt with structured citations.",
                evaluation="Offline answer set scored weekly.",
                responsible_ai_safety="Content filters and refusal on unknown topics.",
                monitoring_feedback="Agent thumbs up or down feeds the review queue.",
                human_review="Agents confirm answers before sending them to customers.",
                data_privacy="No personal data is sent to the model.",
                basis=Basis.INFERRED,
                req_ids=["FR_03"],
            )
        ],
        deterministic_areas=[
            Statement(
                text="Premium calculation stays rule based.",
                basis=Basis.CUSTOMER,
                req_ids=["FR_01"],
            )
        ],
        mandatory_human_decisions=[
            Statement(
                text="Rejecting a policy stays with a human.",
                basis=Basis.CUSTOMER,
                req_ids=["SEC_01"],
            )
        ],
        architecture_pattern="Retrieval-augmented generation with a managed model service.",
        provider_options=[
            ProviderOption(
                platform=ProviderPlatformScope.AZURE,
                provider="Azure OpenAI",
                models=["GPT-4o mini"],
                rationale="Runs inside the customer's existing tenant.",
            )
        ],
        framework_recommendations=[
            FrameworkRecommendation(
                name="LangChain",
                purpose="Retrieval and prompt orchestration.",
                rationale="Structured output keeps the assistant answers checkable.",
                alternatives_considered=["Direct SDK calls"],
                basis=Basis.RECOMMENDED,
                req_ids=["FR_03"],
            )
        ],
    )


_UNITS: tuple[tuple[str, UnitType, str, Complexity], ...] = (
    ("CAP_01", UnitType.CAPABILITY, "WS_01", Complexity.HIGH),
    ("CAP_02", UnitType.CAPABILITY, "WS_01", Complexity.MEDIUM),
    ("CAP_03", UnitType.CAPABILITY, "WS_02", Complexity.HIGH),
    ("CAP_04", UnitType.CAPABILITY, "WS_03", Complexity.MEDIUM),
    ("IA_01", UnitType.INTEGRATION, "WS_01", Complexity.MEDIUM),
    ("AI_01", UnitType.AI_USE_CASE, "WS_02", Complexity.HIGH),
    ("ARC_03", UnitType.ARCHITECTURE_COMPONENT, "WS_03", Complexity.MEDIUM),
    ("DOM_01", UnitType.DATA_DOMAIN, "WS_03", Complexity.MEDIUM),
)


def _estimate_drivers() -> EstimateDrivers:
    return EstimateDrivers(
        units=[
            EstimateUnit(
                unit_id=unit_id,
                unit_type=unit_type,
                workstream_id=workstream_id,
                complexity=complexity,
                drivers=["Reviewed with the delivery lead"],
            )
            for unit_id, unit_type, workstream_id, complexity in _UNITS
        ],
        workstreams=[
            DriverWorkstream(
                id="WS_01",
                name="Onboarding and portal",
                capability_ids=["CAP_01", "CAP_02"],
                integration_ids=["IA_01"],
                arc_ids=["ARC_01", "ARC_02", "ARC_05"],
                derived_complexity=Complexity.HIGH,
                roles=["Solution Architect", "Backend Engineer"],
                risks=["CRM API access"],
                dependencies=["CRM sandbox"],
                basis=Basis.CUSTOMER,
                req_ids=["FR_01", "FR_02", "INT_01", "NFR_02"],
            ),
            DriverWorkstream(
                id="WS_02",
                name="Knowledge assistant",
                capability_ids=["CAP_03"],
                ai_use_case_ids=["AI_01"],
                arc_ids=["ARC_06"],
                derived_complexity=Complexity.HIGH,
                roles=["AI Engineer"],
                basis=Basis.INFERRED,
                req_ids=["FR_03"],
            ),
            DriverWorkstream(
                id="WS_03",
                name="Data and compliance",
                capability_ids=["CAP_04"],
                arc_ids=["ARC_03", "ARC_04", "ARC_07", "ARC_08"],
                domain_ids=["DOM_01"],
                derived_complexity=Complexity.MEDIUM,
                roles=["Data Engineer"],
                basis=Basis.CUSTOMER,
                req_ids=["DATA_01", "SEC_01", "NFR_01"],
            ),
            DriverWorkstream(
                id="WS_04",
                name="Testing and hardening",
                derived_complexity=Complexity.MEDIUM,
                roles=["QA Engineer"],
                basis=Basis.RECOMMENDED,
            ),
        ],
        phases=[
            DriverPhase(
                name="Build", workstream_ids=["WS_01", "WS_02", "WS_03"], milestones=["Portal demo"]
            ),
            DriverPhase(
                name="Hardening", workstream_ids=["WS_04"], milestones=["Go live readiness"]
            ),
        ],
        delivery_risks=[
            Statement(text="CRM access may be late.", basis=Basis.INFERRED, req_ids=["INT_01"])
        ],
        estimation_assumptions=[
            Statement(text="One delivery team of five people.", basis=Basis.ASSUMED)
        ],
        exclusions=[Statement(text="Cloud consumption and licences.", basis=Basis.RECOMMENDED)],
    )


_ESTIMATE_LINES: tuple[tuple[str, str, list[str], float, float, ConfidenceLevel, bool], ...] = (
    (
        "WS_01",
        "Onboarding and portal",
        ["FR_01", "FR_02", "INT_01", "NFR_02"],
        18.0,
        24.0,
        ConfidenceLevel.MEDIUM,
        False,
    ),
    ("WS_02", "Knowledge assistant", ["FR_03"], 10.0, 14.0, ConfidenceLevel.MEDIUM, False),
    (
        "WS_03",
        "Data and compliance",
        ["DATA_01", "SEC_01", "NFR_01"],
        12.0,
        16.0,
        ConfidenceLevel.HIGH,
        False,
    ),
    ("WS_04", "Testing and hardening", [], 6.0, 8.0, ConfidenceLevel.MEDIUM, True),
)


def estimate() -> Estimate:
    lines = [
        WorkstreamEstimate(
            workstream_id=workstream_id,
            name=name,
            req_ids=req_ids,
            roles=["Backend Engineer"],
            complexity=Complexity.MEDIUM,
            effort_low=low,
            effort_high=high,
            confidence=confidence,
            overhead=overhead,
        )
        for workstream_id, name, req_ids, low, high, confidence, overhead in _ESTIMATE_LINES
    ]
    effort_low = sum(line.effort_low for line in lines)
    effort_high = sum(line.effort_high for line in lines)
    return Estimate(
        workstreams=lines,
        phases=[
            PhaseEstimate(
                name="Build",
                workstream_ids=["WS_01", "WS_02", "WS_03"],
                weeks_low=8.0,
                weeks_high=11.0,
            ),
            PhaseEstimate(
                name="Hardening", workstream_ids=["WS_04"], weeks_low=2.0, weeks_high=3.0
            ),
        ],
        effort_low=effort_low,
        effort_high=effort_high,
        effort_incl_contingency_low=effort_low * 1.15,
        effort_incl_contingency_high=effort_high * 1.15,
        timeline_weeks_low=10.0,
        timeline_weeks_high=14.0,
        rom=RomRange(
            amount_low=430000.0,
            amount_high=580000.0,
            currency="USD",
            rate_basis="role mix",
            contingency_pct=0.15,
        ),
        overall_confidence=ConfidenceLevel.MEDIUM,
        rate_card_id="usd-standard",
        config_hash=CONFIG_HASH,
        calculated_at=NOW,
    )


def rate_card() -> RateCard:
    return RateCard(
        id="usd-standard",
        name="Standard blended consulting rates (USD)",
        currency="USD",
        rates=[
            RoleRate(role="Solution Architect", rate_per_person_week=10400),
            RoleRate(role="Backend Engineer", rate_per_person_week=8000),
            RoleRate(role="Data Engineer", rate_per_person_week=8400),
            RoleRate(role="AI Engineer", rate_per_person_week=9200),
            RoleRate(role="QA Engineer", rate_per_person_week=6800),
        ],
    )


def _executive_summary() -> ExecutiveSummary:
    return ExecutiveSummary(
        overview="A policy platform on Azure with an AI support assistant.",
        customer_objectives=[
            Statement(text="Cut policy handling time.", basis=Basis.CUSTOMER, req_ids=["BR_01"])
        ],
        solution_highlights=[
            Statement(
                text="Guided onboarding with CRM sync.", basis=Basis.CUSTOMER, req_ids=["FR_01"]
            )
        ],
        commercial_summary="46 to 62 person-weeks, 430,000 to 580,000 USD.",
        key_risks=[
            Statement(
                text="Legacy policy logic is undocumented.",
                basis=Basis.INFERRED,
                req_ids=["RISK_01"],
            )
        ],
        next_steps=[
            Statement(
                text="Confirm the CRM access date.", basis=Basis.RECOMMENDED, req_ids=["ASM_01"]
            )
        ],
    )


def artifact_contents() -> dict[ArtifactKind, dict[str, Any]]:
    """All artifact contents, dumped exactly as the database stores them."""
    return {
        ArtifactKind.PRD: _prd().model_dump(mode="json"),
        ArtifactKind.FUNCTIONAL_SCOPE: _functional_scope().model_dump(mode="json"),
        ArtifactKind.ARCHITECTURE: _architecture().model_dump(mode="json"),
        ArtifactKind.DATA_STRATEGY: _data_strategy().model_dump(mode="json"),
        ArtifactKind.INTEGRATION_ARCHITECTURE: _integration_architecture().model_dump(mode="json"),
        ArtifactKind.AI_STRATEGY: _ai_strategy().model_dump(mode="json"),
        ArtifactKind.ESTIMATE_DRIVERS: _estimate_drivers().model_dump(mode="json"),
        ArtifactKind.ESTIMATE: estimate().model_dump(mode="json"),
        ArtifactKind.EXECUTIVE_SUMMARY: _executive_summary().model_dump(mode="json"),
    }


def artifact_statuses() -> dict[ArtifactKind, ArtifactStatus]:
    return dict.fromkeys(artifact_contents(), ArtifactStatus.FRESH)


def session_config() -> SessionConfig:
    return SessionConfig(
        rate_card_id="usd-standard",
        expected_users=50000,
        target_regions=["eu-west"],
        delivery_deadline=date(2027, 3, 31),
        security_level=SecurityLevel.ELEVATED,
        regulatory_constraints=["GDPR"],
        ai_provider_preference=AiProviderPreference.PLATFORM_NATIVE,
        contingency_pct=0.15,
    )


def session_state() -> SessionState:
    return SessionState(
        session_id=SESSION_ID,
        scope_version=SCOPE_VERSION,
        cloud_platform=CloudPlatform.AZURE,
        config=session_config(),
        items=scope_items(),
        artifacts=artifact_contents(),
    )


def catalog_services() -> dict[str, frozenset[str]]:
    return {"azure": AZURE_SERVICES}


def quality_context(
    items: list[ScopeItem] | None = None,
    contents: dict[ArtifactKind, dict[str, Any]] | None = None,
    statuses: dict[ArtifactKind, ArtifactStatus] | None = None,
    current_estimate: Estimate | None = None,
    config: SessionConfig | None = None,
) -> QualityContext:
    """A context over the clean fixture; pass a broken piece to force a finding."""
    contents = artifact_contents() if contents is None else contents
    return build_context(
        session_id=SESSION_ID,
        scope_version=SCOPE_VERSION,
        items=scope_items() if items is None else items,
        contents=contents,
        config=session_config() if config is None else config,
        statuses=artifact_statuses() if statuses is None else statuses,
        estimate=estimate() if current_estimate is None else current_estimate,
        cloud_platform=CloudPlatform.AZURE,
        catalog_services=catalog_services(),
        rate_card=rate_card(),
        expected_config_hash=CONFIG_HASH,
        required_kinds=REQUIRED_ARTIFACT_KINDS,
    )
