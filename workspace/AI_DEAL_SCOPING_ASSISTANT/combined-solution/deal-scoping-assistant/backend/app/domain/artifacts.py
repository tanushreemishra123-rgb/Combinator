"""Generated artifact contents (PLAN section 3).

Schemas are kept friendly to strict JSON-schema output: string enums, no alternative
unions, no recursion, no free-key maps, and a description on every field.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import Field, model_validator

from app.domain.base import DomainModel
from app.domain.scope import (
    CloudPlatform,
    IntegrationDirection,
    IntegrationPattern,
    Priority,
)


class ArtifactKind(StrEnum):
    PRD = "prd"
    FUNCTIONAL_SCOPE = "functional_scope"
    PLATFORM_RECOMMENDATION = "platform_recommendation"
    ARCHITECTURE = "architecture"
    DATA_STRATEGY = "data_strategy"
    INTEGRATION_ARCHITECTURE = "integration_architecture"
    AI_STRATEGY = "ai_strategy"
    ESTIMATE_DRIVERS = "estimate_drivers"
    ESTIMATE = "estimate"
    EXECUTIVE_SUMMARY = "executive_summary"


class ArtifactStatus(StrEnum):
    FRESH = "fresh"
    STALE = "stale"


class Basis(StrEnum):
    CUSTOMER = "customer"
    INFERRED = "inferred"
    ASSUMED = "assumed"
    RECOMMENDED = "recommended"


class ScopeClass(StrEnum):
    CUSTOMER_REQUESTED = "customer_requested"
    AI_INTERPRETED = "ai_interpreted"
    RECOMMENDED_ENHANCEMENT = "recommended_enhancement"
    ASSUMPTION_PENDING = "assumption_pending"


class EngagementModel(StrEnum):
    TOPCODER_CHALLENGES = "topcoder_challenges"
    DELIVERY_PACKAGE = "delivery_package"
    BLENDED = "blended"


class ArchitectureArea(StrEnum):
    """The 14 architecture areas named by the challenge."""

    USER_FACING_APPLICATIONS = "user_facing_applications"
    BACKEND_SERVICES = "backend_services"
    APIS = "apis"
    DATABASES_AND_STORAGE = "databases_and_storage"
    IDENTITY_AND_ACCESS_MANAGEMENT = "identity_and_access_management"
    MESSAGING_AND_EVENT_PROCESSING = "messaging_and_event_processing"
    INTEGRATION_COMPONENTS = "integration_components"
    AI_AND_ML_SERVICES = "ai_and_ml_services"
    OBSERVABILITY_AND_MONITORING = "observability_and_monitoring"
    SECURITY_CONTROLS = "security_controls"
    DEPLOYMENT_AND_RUNTIME = "deployment_and_runtime"
    ENVIRONMENTS_DEV_TEST_PROD = "environments_dev_test_prod"
    AVAILABILITY_AND_SCALABILITY = "availability_and_scalability"
    BACKUP_AND_DISASTER_RECOVERY = "backup_and_disaster_recovery"


class ProcessingClass(StrEnum):
    AI = "ai"
    DETERMINISTIC = "deterministic"
    HUMAN_DECISION = "human_decision"


class ProviderPlatformScope(StrEnum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    ANY = "any"


class Complexity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class UnitType(StrEnum):
    CAPABILITY = "capability"
    INTEGRATION = "integration"
    AI_USE_CASE = "ai_use_case"
    ARCHITECTURE_COMPONENT = "architecture_component"
    DATA_DOMAIN = "data_domain"


class Element(DomainModel):
    """Base for every generated element: its grounding and whether a human must check it."""

    req_ids: list[str] = Field(
        default_factory=list, description="Scope item ids this element is grounded in."
    )
    basis: Basis = Field(description="customer, inferred, assumed or recommended.")
    validation_required: bool = Field(
        default=False, description="True when a human must validate this element before use."
    )
    validation_reason: str = Field(
        default="", description="Why human validation is required, when it is."
    )


class Statement(Element):
    """A single grounded sentence used for list sections."""

    text: str = Field(description="The statement itself.")


class NarrativeSection(Element):
    """A prose section that also points at architecture components."""

    text: str = Field(description="Section content.")
    arc_ids: list[str] = Field(
        default_factory=list, description="Architecture component ids referenced by the section."
    )


class Flow(DomainModel):
    from_id: str = Field(description="Id or name of the source component or system.")
    to_id: str = Field(description="Id or name of the target component or system.")
    label: str = Field(description="What moves between them.")
    protocol: str = Field(default="", description="Protocol or mechanism, for example HTTPS REST.")


class OutOfScopeItem(Element):
    text: str = Field(description="What is out of scope.")
    reason: str = Field(description="Why it is out of scope.")


# --- PRD ---------------------------------------------------------------------


class Persona(Element):
    name: str = Field(description="Persona name.")
    description: str = Field(description="Who they are and what they do.")
    needs: list[str] = Field(default_factory=list, description="Primary needs of the persona.")


class UserJourney(Element):
    name: str = Field(description="Journey or workflow name.")
    actor: str = Field(description="Persona or role performing the journey.")
    steps: list[str] = Field(default_factory=list, description="Ordered steps of the journey.")


class PrdRequirement(Element):
    req_id: str = Field(description="Scope item id this PRD requirement restates, e.g. FR_01.")
    statement: str = Field(description="Requirement statement in PRD wording.")
    acceptance_conditions: list[str] = Field(
        default_factory=list, description="Conditions that show the requirement is met."
    )


class TraceabilityEntry(DomainModel):
    req_id: str = Field(description="Scope item id.")
    sections: list[str] = Field(
        default_factory=list, description="PRD sections where the requirement appears."
    )


class Prd(DomainModel):
    overview: str = Field(description="Product or solution overview.")
    business_problem: str = Field(description="The business problem being solved.")
    objectives: list[Statement] = Field(
        default_factory=list, description="Business objectives (BR ids)."
    )
    personas: list[Persona] = Field(
        default_factory=list, description="Target users and personas (PER ids)."
    )
    user_journeys: list[UserJourney] = Field(
        default_factory=list, description="User journeys or key workflows."
    )
    functional_requirements: list[PrdRequirement] = Field(
        default_factory=list, description="Functional requirements."
    )
    non_functional_requirements: list[PrdRequirement] = Field(
        default_factory=list, description="Non-functional requirements."
    )
    integrations: list[Statement] = Field(default_factory=list, description="Integrations.")
    dependencies: list[Statement] = Field(default_factory=list, description="Dependencies.")
    assumptions: list[Statement] = Field(default_factory=list, description="Assumptions (ASM ids).")
    risks: list[Statement] = Field(default_factory=list, description="Risks.")
    out_of_scope: list[OutOfScopeItem] = Field(
        default_factory=list, description="Out-of-scope items."
    )
    open_questions: list[Statement] = Field(
        default_factory=list, description="Open questions (Q ids)."
    )
    traceability: list[TraceabilityEntry] = Field(
        default_factory=list, description="Requirement to PRD section traceability."
    )


# --- Functional scope --------------------------------------------------------


class Capability(Element):
    id: str = Field(description="Capability id such as CAP_01.")
    name: str = Field(description="Capability name.")
    description: str = Field(description="What the capability delivers.")
    included_req_ids: list[str] = Field(
        description="Reviewed requirement ids covered by this capability; at least one."
    )
    priority: Priority = Field(description="Delivery priority.")
    dependencies: list[str] = Field(
        default_factory=list, description="Other capability ids or external dependencies."
    )
    module: str = Field(default="", description="Module id this capability belongs to.")
    workstream_id: str = Field(default="", description="Workstream id delivering the capability.")
    delivery_package_id: str = Field(default="", description="Delivery package id, when assigned.")
    scope_class: ScopeClass = Field(description="How the capability entered the scope.")

    @model_validator(mode="after")
    def _needs_requirements(self) -> "Capability":
        if not self.included_req_ids:
            raise ValueError("a capability must reference at least one requirement id")
        if not self.req_ids:
            # Keep the shared grounding field in step with the capability's own list.
            self.req_ids = list(self.included_req_ids)
        return self


class Module(Element):
    id: str = Field(description="Module id such as MOD_01.")
    name: str = Field(description="Module name.")
    description: str = Field(default="", description="What the module groups.")
    capability_ids: list[str] = Field(
        default_factory=list, description="Capability ids in this module."
    )


class Workstream(Element):
    id: str = Field(description="Workstream id such as WS_01.")
    name: str = Field(description="Workstream name.")
    capability_ids: list[str] = Field(
        default_factory=list, description="Capability ids delivered by the workstream."
    )


class DeliveryPackage(Element):
    id: str = Field(description="Delivery package id such as DP_01.")
    name: str = Field(description="Delivery package name.")
    capability_ids: list[str] = Field(
        default_factory=list, description="Capability ids in the package."
    )
    engagement_model: EngagementModel = Field(description="How the package would be delivered.")


class RecommendedEnhancement(Element):
    id: str = Field(description="Enhancement id such as ENH_01.")
    description: str = Field(description="The recommended enhancement.")
    rationale: str = Field(description="Why it is recommended.")
    related_req_ids: list[str] = Field(
        default_factory=list, description="Requirements the enhancement builds on."
    )


class FunctionalScope(DomainModel):
    capabilities: list[Capability] = Field(default_factory=list, description="Capabilities.")
    modules: list[Module] = Field(default_factory=list, description="Modules.")
    workstreams: list[Workstream] = Field(default_factory=list, description="Workstreams.")
    delivery_packages: list[DeliveryPackage] = Field(
        default_factory=list, description="Delivery packages."
    )
    out_of_scope: list[OutOfScopeItem] = Field(
        default_factory=list, description="Out-of-scope items."
    )
    recommended_enhancements: list[RecommendedEnhancement] = Field(
        default_factory=list, description="Enhancements recommended beyond the stated scope."
    )


# --- Architecture ------------------------------------------------------------


class PlatformAlternative(DomainModel):
    platform: CloudPlatform = Field(description="Alternative cloud platform.")
    why_not: str = Field(description="Why it was not recommended.")


class PlatformRecommendation(Element):
    recommended: CloudPlatform = Field(description="Recommended cloud platform.")
    rationale: str = Field(description="Why this platform fits the requirements.")
    alternatives: list[PlatformAlternative] = Field(
        default_factory=list, description="Platforms considered and rejected."
    )


class ArchitectureComponent(Element):
    id: str = Field(description="Component id such as ARC_01.")
    name: str = Field(description="Logical component name, platform neutral.")
    area: ArchitectureArea = Field(description="One of the 14 architecture areas.")
    cloud_service: str = Field(description="Service from the selected platform's catalog.")
    purpose: str = Field(description="What the component does in the solution.")
    supported_ids: list[str] = Field(
        description="Requirement or assumption ids that justify the component; at least one."
    )
    rationale: str = Field(description="Why this service was selected.")
    trade_offs: list[str] = Field(default_factory=list, description="Important trade-offs.")
    dependencies: list[str] = Field(
        default_factory=list, description="Other ARC ids this component depends on."
    )
    security_considerations: str = Field(
        default="", description="Security considerations for the component."
    )
    environments: list[str] = Field(
        default_factory=list, description="Environments the component runs in."
    )

    @model_validator(mode="after")
    def _needs_justification(self) -> "ArchitectureComponent":
        if not self.supported_ids:
            raise ValueError("a component must reference at least one requirement or assumption id")
        if not self.req_ids:
            self.req_ids = list(self.supported_ids)
        return self


class Environments(DomainModel):
    dev: str = Field(description="Development environment approach.")
    test: str = Field(description="Test environment approach.")
    prod: str = Field(description="Production environment approach.")


class Architecture(DomainModel):
    platform: CloudPlatform = Field(description="Platform the architecture targets.")
    platform_recommendation: PlatformRecommendation | None = Field(
        default=None, description="Present when the platform was recommended, not selected."
    )
    components: list[ArchitectureComponent] = Field(
        default_factory=list, description="Architecture components grouped by area."
    )
    flows: list[Flow] = Field(default_factory=list, description="Flows between components.")
    environments: Environments = Field(description="Dev, test and production environments.")
    deployment_runtime: NarrativeSection = Field(description="Deployment and runtime approach.")
    availability_scalability: NarrativeSection = Field(description="Availability and scalability.")
    backup_dr: NarrativeSection = Field(description="Backup and disaster recovery.")
    observability: NarrativeSection = Field(description="Observability and monitoring.")
    security_controls: NarrativeSection = Field(description="Security controls.")


# --- Data strategy -----------------------------------------------------------


class DataDomain(Element):
    id: str = Field(description="Data domain id such as DOM_01.")
    name: str = Field(description="Domain name.")
    description: str = Field(description="What data the domain holds.")
    sources: list[str] = Field(default_factory=list, description="Systems the data comes from.")
    owner: str = Field(default="", description="Business owner of the domain.")


class DataStrategy(DomainModel):
    domains: list[DataDomain] = Field(default_factory=list, description="Major data domains.")
    ingestion: NarrativeSection = Field(description="Data ingestion.")
    transactional_storage: NarrativeSection = Field(description="Transactional storage.")
    analytical_storage: NarrativeSection = Field(description="Analytical storage.")
    quality: NarrativeSection = Field(description="Data quality.")
    metadata_governance: NarrativeSection = Field(description="Metadata and governance.")
    retention: NarrativeSection = Field(description="Data retention.")
    privacy_security: NarrativeSection = Field(description="Privacy and security.")
    reporting_analytics: NarrativeSection = Field(description="Reporting and analytics.")
    backup_recovery: NarrativeSection = Field(description="Backup and recovery.")


# --- Integration architecture ------------------------------------------------


class IntegrationItem(Element):
    id: str = Field(description="Integration id such as IA_01.")
    name: str = Field(description="Integration name.")
    source_system: str = Field(description="System the information comes from.")
    target_system: str = Field(description="System the information goes to.")
    direction: IntegrationDirection = Field(description="Direction of the flow.")
    pattern: IntegrationPattern = Field(description="api, event, batch or file.")
    auth_approach: str = Field(description="Authentication approach.")
    error_handling: str = Field(description="Error handling approach.")
    retry_behavior: str = Field(description="Retry behaviour.")
    monitoring: str = Field(description="How the integration is monitored.")
    sync_considerations: str = Field(description="Data synchronization considerations.")
    arc_ids: list[str] = Field(
        default_factory=list, description="Architecture component ids involved."
    )

    @model_validator(mode="after")
    def _needs_integration_requirement(self) -> "IntegrationItem":
        if not any(ref.startswith(("INT_", "DATA_")) for ref in self.req_ids):
            raise ValueError("an integration must reference at least one INT or DATA requirement")
        return self


class SystemRef(Element):
    name: str = Field(description="System name.")
    description: str = Field(default="", description="Role of the system in the solution.")


class IntegrationArchitecture(DomainModel):
    integrations: list[IntegrationItem] = Field(
        default_factory=list, description="Planned integrations."
    )
    internal_systems: list[SystemRef] = Field(
        default_factory=list, description="Internal systems involved."
    )
    external_systems: list[SystemRef] = Field(
        default_factory=list, description="External systems involved."
    )
    flows: list[Flow] = Field(
        default_factory=list, description="How information moves between systems and components."
    )


# --- AI strategy -------------------------------------------------------------


class AiUseCase(Element):
    id: str = Field(description="AI use case id such as AI_01.")
    name: str = Field(description="Use case name.")
    description: str = Field(description="What the use case does.")
    processing_class: ProcessingClass = Field(
        description="ai, deterministic or human_decision processing."
    )
    pattern: str = Field(description="AI pattern, for example retrieval-augmented generation.")
    model_options: list[str] = Field(default_factory=list, description="Candidate models.")
    retrieval_required: bool = Field(default=False, description="Whether retrieval is needed.")
    retrieval_notes: str = Field(default="", description="Retrieval approach, when required.")
    orchestration: str = Field(default="", description="Agent or workflow orchestration.")
    prompt_and_structured_output: str = Field(
        default="", description="Prompt and structured-output management."
    )
    evaluation: str = Field(default="", description="Evaluation approach.")
    responsible_ai_safety: str = Field(
        default="", description="Responsible-AI and safety considerations."
    )
    monitoring_feedback: str = Field(default="", description="Monitoring and feedback loop.")
    human_review: str = Field(default="", description="Human-review requirements.")
    data_privacy: str = Field(default="", description="Data privacy considerations.")


class ProviderOption(DomainModel):
    platform: ProviderPlatformScope = Field(description="Platform this option applies to.")
    provider: str = Field(description="Model or service provider.")
    models: list[str] = Field(default_factory=list, description="Models offered by the provider.")
    rationale: str = Field(description="Why this option fits the solution.")


class FrameworkRecommendation(Element):
    name: str = Field(description="Framework or service name.")
    purpose: str = Field(description="What it is used for in this solution.")
    rationale: str = Field(description="Solution-specific reason for the recommendation.")
    alternatives_considered: list[str] = Field(
        default_factory=list, description="Alternatives that were considered."
    )


class AiStrategy(DomainModel):
    ai_requirements: list[Statement] = Field(
        default_factory=list, description="AI-specific requirements such as accuracy or latency."
    )
    use_cases: list[AiUseCase] = Field(default_factory=list, description="Suitable AI use cases.")
    deterministic_areas: list[Statement] = Field(
        default_factory=list, description="Areas better served by deterministic processing."
    )
    mandatory_human_decisions: list[Statement] = Field(
        default_factory=list, description="Decisions that must stay with a human."
    )
    architecture_pattern: str = Field(description="Recommended AI architecture pattern.")
    provider_options: list[ProviderOption] = Field(
        default_factory=list, description="Model or provider options per platform."
    )
    framework_recommendations: list[FrameworkRecommendation] = Field(
        default_factory=list, description="Recommended frameworks or services."
    )


# --- Estimate drivers --------------------------------------------------------


class EstimateUnit(DomainModel):
    unit_id: str = Field(description="Id of the estimated unit, for example CAP_01 or IA_02.")
    unit_type: UnitType = Field(description="What kind of unit this is.")
    workstream_id: str = Field(description="Workstream the unit belongs to.")
    complexity: Complexity = Field(description="Complexity level; editable by the reviewer.")
    drivers: list[str] = Field(
        default_factory=list, description="Why the unit has this complexity."
    )


class DriverWorkstream(Element):
    id: str = Field(description="Workstream id, aligned with the functional scope.")
    name: str = Field(description="Workstream name.")
    capability_ids: list[str] = Field(default_factory=list, description="Capability ids included.")
    integration_ids: list[str] = Field(default_factory=list, description="IA ids included.")
    ai_use_case_ids: list[str] = Field(
        default_factory=list, description="AI use case ids included."
    )
    arc_ids: list[str] = Field(default_factory=list, description="Architecture component ids.")
    domain_ids: list[str] = Field(default_factory=list, description="Data domain ids included.")
    derived_complexity: Complexity = Field(description="Summary complexity of the workstream.")
    roles: list[str] = Field(default_factory=list, description="Roles or skill categories needed.")
    risks: list[str] = Field(default_factory=list, description="Delivery risks for the workstream.")
    dependencies: list[str] = Field(default_factory=list, description="Dependencies to resolve.")


class DriverPhase(DomainModel):
    name: str = Field(description="Delivery phase name.")
    workstream_ids: list[str] = Field(
        default_factory=list, description="Workstreams delivered in the phase."
    )
    milestones: list[str] = Field(default_factory=list, description="Milestones at the phase end.")


class EstimateDrivers(DomainModel):
    units: list[EstimateUnit] = Field(default_factory=list, description="Estimated units.")
    workstreams: list[DriverWorkstream] = Field(default_factory=list, description="Workstreams.")
    phases: list[DriverPhase] = Field(default_factory=list, description="Delivery phases.")
    delivery_risks: list[Statement] = Field(default_factory=list, description="Delivery risks.")
    estimation_assumptions: list[Statement] = Field(
        default_factory=list, description="Assumptions the estimate rests on."
    )
    exclusions: list[Statement] = Field(
        default_factory=list, description="What the estimate excludes, e.g. licences."
    )


# --- Executive summary -------------------------------------------------------


class ExecutiveSummary(DomainModel):
    overview: str = Field(description="One-paragraph summary of the proposed solution.")
    customer_objectives: list[Statement] = Field(
        default_factory=list, description="What the customer wants to achieve."
    )
    solution_highlights: list[Statement] = Field(
        default_factory=list, description="Key points of the proposed solution."
    )
    commercial_summary: str = Field(
        default="", description="Effort, timeline and ROM in one paragraph."
    )
    key_risks: list[Statement] = Field(default_factory=list, description="Key risks to flag.")
    next_steps: list[Statement] = Field(default_factory=list, description="Recommended next steps.")


# --- Envelope ----------------------------------------------------------------


class ArtifactEnvelope(DomainModel):
    """API view of a stored artifact; `content` holds the model for `kind`."""

    kind: ArtifactKind = Field(description="Artifact kind.")
    version: int = Field(description="Version, incremented on every regeneration.")
    scope_version_used: int = Field(description="Scope version the artifact was generated from.")
    config_hash_used: str = Field(description="Hash of the session config used.")
    status: ArtifactStatus = Field(description="fresh or stale.")
    stale_reasons: list[str] = Field(
        default_factory=list, description="Why the artifact is stale, when it is."
    )
    generated_by: str = Field(description="mock:recorded or live:<provider>/<model>.")
    created_at: datetime = Field(description="When this version was generated.")
    content: dict[str, Any] = Field(description="Validated content of the artifact kind.")


CONTENT_MODEL_BY_KIND: dict[ArtifactKind, type[DomainModel]] = {
    ArtifactKind.PRD: Prd,
    ArtifactKind.FUNCTIONAL_SCOPE: FunctionalScope,
    ArtifactKind.PLATFORM_RECOMMENDATION: PlatformRecommendation,
    ArtifactKind.ARCHITECTURE: Architecture,
    ArtifactKind.DATA_STRATEGY: DataStrategy,
    ArtifactKind.INTEGRATION_ARCHITECTURE: IntegrationArchitecture,
    ArtifactKind.AI_STRATEGY: AiStrategy,
    ArtifactKind.ESTIMATE_DRIVERS: EstimateDrivers,
    ArtifactKind.EXECUTIVE_SUMMARY: ExecutiveSummary,
}
