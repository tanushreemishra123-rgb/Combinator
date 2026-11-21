"""The reviewable scope model: sessions, source documents and scope items."""

from datetime import date, datetime
from enum import StrEnum

from pydantic import Field, model_validator

from app.domain.base import DomainModel


class ItemType(StrEnum):
    """The 15 scope categories; the value doubles as the id prefix (FR_01, NFR_02, ...)."""

    BUSINESS_OBJECTIVE = "BR"
    PERSONA = "PER"
    FUNCTIONAL_REQUIREMENT = "FR"
    NON_FUNCTIONAL_REQUIREMENT = "NFR"
    EXISTING_SYSTEM = "SYS"
    INTEGRATION = "INT"
    DATA_REQUIREMENT = "DATA"
    SECURITY_COMPLIANCE = "SEC"
    TECHNOLOGY_PREFERENCE = "TECH"
    DELIVERY_CONSTRAINT = "CON"
    DEPENDENCY = "DEP"
    RISK = "RISK"
    MISSING_INFORMATION = "GAP"
    ASSUMPTION = "ASM"
    CLARIFICATION_QUESTION = "Q"


class Priority(StrEnum):
    MUST = "must"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Origin(StrEnum):
    CUSTOMER_STATED = "customer_stated"
    AI_INFERRED = "ai_inferred"
    ASSUMED = "assumed"


class ItemStatus(StrEnum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    MODIFIED = "modified"
    REJECTED = "rejected"


class UpdatedBy(StrEnum):
    AI = "ai"
    USER = "user"


class NfrCategory(StrEnum):
    PERFORMANCE = "performance"
    SCALABILITY = "scalability"
    AVAILABILITY = "availability"
    SECURITY = "security"
    COMPLIANCE = "compliance"
    USABILITY = "usability"
    MAINTAINABILITY = "maintainability"
    OBSERVABILITY = "observability"


class IntegrationDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    BIDIRECTIONAL = "bidirectional"


class IntegrationPattern(StrEnum):
    API = "api"
    EVENT = "event"
    BATCH = "batch"
    FILE = "file"


class GapCriticality(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ConfirmationStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class AnswerStatus(StrEnum):
    OPEN = "open"
    ANSWERED = "answered"
    DISMISSED = "dismissed"


class SegmentKind(StrEnum):
    PAGE = "page"
    HEADING = "heading"
    PARAGRAPH = "paragraph"


class DocumentKind(StrEnum):
    PASTED = "pasted"
    UPLOADED = "uploaded"


class DocumentFormat(StrEnum):
    TXT = "txt"
    MD = "md"
    PDF = "pdf"
    DOCX = "docx"


class ScopeStatus(StrEnum):
    EMPTY = "empty"
    ANALYZED = "analyzed"
    APPROVED = "approved"


class CloudPlatform(StrEnum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"


class PlatformMode(StrEnum):
    SELECTED = "selected"
    RECOMMENDED = "recommended"


class SecurityLevel(StrEnum):
    STANDARD = "standard"
    ELEVATED = "elevated"
    REGULATED = "regulated"


class TestingLevel(StrEnum):
    STANDARD = "standard"
    EXTENDED = "extended"


class DataMigration(StrEnum):
    NONE = "none"
    LIGHT = "light"
    HEAVY = "heavy"


class BlendedRateMode(StrEnum):
    ROLE_MIX = "role_mix"
    EXPLICIT = "explicit"


class AiProviderPreference(StrEnum):
    PLATFORM_NATIVE = "platform_native"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPEN_SOURCE = "open_source"
    NONE = "none"


class SourceRef(DomainModel):
    document_id: str = Field(description="Id of the source document the text came from.")
    segment_id: str = Field(description="Segment id inside that document, for example D1.S12.")
    quote: str = Field(description="Exact customer text this item was taken from.")
    start: int = Field(default=0, ge=0, description="Start offset of the quote in the document.")
    end: int = Field(default=0, ge=0, description="End offset of the quote in the document.")
    verified: bool = Field(
        default=False, description="True when the quote was matched against the segment text."
    )


class Segment(DomainModel):
    segment_id: str = Field(description="Stable segment id, for example D1.S12.")
    kind: SegmentKind = Field(description="Segment granularity: page, heading or paragraph.")
    index: int = Field(description="Position of the segment within the document.")
    page: int | None = Field(default=None, description="Page number for PDF sources.")
    heading: str = Field(default="", description="Nearest heading text, when known.")
    text: str = Field(description="Normalized text of the segment.")
    start: int = Field(description="Start offset in the normalized document text.")
    end: int = Field(description="End offset in the normalized document text.")


class SourceDocument(DomainModel):
    id: str = Field(description="Document id.")
    session_id: str = Field(description="Owning session id.")
    name: str = Field(description="File name or a label for pasted text.")
    kind: DocumentKind = Field(description="Whether the text was pasted or uploaded.")
    format: DocumentFormat = Field(description="Source format of the document.")
    normalized_text: str = Field(description="Plain text extracted from the source.")
    segments: list[Segment] = Field(default_factory=list, description="Addressable text segments.")
    created_at: datetime = Field(description="Creation timestamp.")


class NfrDetails(DomainModel):
    category: NfrCategory = Field(description="Non-functional requirement category.")


class IntegrationDetails(DomainModel):
    system: str = Field(description="External or internal system involved.")
    direction: IntegrationDirection = Field(description="Direction of the information flow.")
    pattern: IntegrationPattern = Field(description="Integration pattern: api, event, batch, file.")


class GapDetails(DomainModel):
    criticality: GapCriticality = Field(description="How critical the missing information is.")
    impacted_areas: list[str] = Field(
        default_factory=list, description="Areas affected by the missing information."
    )
    question_id: str = Field(
        default="", description="Clarification question raised for this gap, if any."
    )
    assumption_id: str = Field(default="", description="Assumption made for this gap, if any.")


class AssumptionDetails(DomainModel):
    requires_confirmation: bool = Field(
        default=True, description="True when the customer must confirm this assumption."
    )
    confirmation_status: ConfirmationStatus = Field(
        default=ConfirmationStatus.PENDING, description="Confirmation state of the assumption."
    )
    impact_if_wrong: str = Field(
        default="", description="What changes in the solution if the assumption is wrong."
    )


class QuestionDetails(DomainModel):
    why_it_matters: str = Field(default="", description="Why the answer changes the solution.")
    affected_ids: list[str] = Field(
        default_factory=list, description="Scope item ids that depend on the answer."
    )
    answer_status: AnswerStatus = Field(
        default=AnswerStatus.OPEN,
        description="Whether the question is open, answered or dismissed.",
    )
    answer: str = Field(default="", description="Answer recorded by the reviewer.")


class ScopeItemDetails(DomainModel):
    """Type-specific fields; exactly one block is filled, matching the item type."""

    nfr: NfrDetails | None = Field(default=None, description="Details for NFR items.")
    integration: IntegrationDetails | None = Field(
        default=None, description="Details for INT items."
    )
    gap: GapDetails | None = Field(default=None, description="Details for GAP items.")
    assumption: AssumptionDetails | None = Field(default=None, description="Details for ASM items.")
    question: QuestionDetails | None = Field(default=None, description="Details for Q items.")


_ABSENCE_TYPES = (ItemType.MISSING_INFORMATION, ItemType.CLARIFICATION_QUESTION)

_DETAILS_FIELD_BY_TYPE = {
    ItemType.NON_FUNCTIONAL_REQUIREMENT: "nfr",
    ItemType.INTEGRATION: "integration",
    ItemType.MISSING_INFORMATION: "gap",
    ItemType.ASSUMPTION: "assumption",
    ItemType.CLARIFICATION_QUESTION: "question",
}


class ScopeItemBase(DomainModel):
    type: ItemType = Field(description="Scope category; also the id prefix.")
    title: str = Field(min_length=1, description="Short title of the item.")
    description: str = Field(default="", description="Full statement of the item.")
    priority: Priority = Field(default=Priority.MEDIUM, description="Review priority.")
    origin: Origin = Field(description="customer_stated, ai_inferred or assumed.")
    source_refs: list[SourceRef] = Field(
        default_factory=list, description="References to the originating customer text."
    )
    related_ids: list[str] = Field(
        default_factory=list, description="Related scope item ids (dependencies, questions)."
    )
    tags: list[str] = Field(
        default_factory=list, description="Tags used by change-impact rules, e.g. scalability."
    )
    notes: str = Field(default="", description="Reviewer notes.")
    absence_note: str = Field(
        default="", description="Why there is no source reference, for GAP and Q items."
    )
    details: ScopeItemDetails = Field(
        default_factory=ScopeItemDetails, description="Type-specific fields."
    )

    @model_validator(mode="after")
    def _check_details(self) -> "ScopeItemBase":
        expected = _DETAILS_FIELD_BY_TYPE.get(self.type)
        if expected and getattr(self.details, expected) is None:
            raise ValueError(f"{self.type} items need details.{expected}")
        return self

    def grounding_errors(self) -> list[str]:
        """Traceability rules for AI-produced items.

        Items a reviewer types in (for example something the customer said on a call)
        have no document quote, so these rules are not applied to them.
        """
        errors: list[str] = []
        needs_source = self.origin in (Origin.CUSTOMER_STATED, Origin.AI_INFERRED)
        if needs_source and not self.source_refs:
            errors.append(f"{self.origin} items need at least one source reference")
        if self.type in _ABSENCE_TYPES and not self.source_refs and not self.absence_note.strip():
            errors.append(f"{self.type} items without a source reference need an absence_note")
        # Assumed items stay traceable through the gap or question that triggered them.
        if self.origin is Origin.ASSUMED and not any(
            ref.startswith(("GAP_", "Q_")) for ref in self.related_ids
        ):
            errors.append("assumed items must link to a GAP or Q id in related_ids")
        return errors


class ScopeItem(ScopeItemBase):
    id: str = Field(description="Stable per-session id such as FR_01.")
    status: ItemStatus = Field(default=ItemStatus.PROPOSED, description="Review status.")
    version: int = Field(default=1, description="Item version, bumped on every change.")
    updated_by: UpdatedBy = Field(default=UpdatedBy.AI, description="Who last changed the item.")
    created_at: datetime = Field(description="Creation timestamp.")
    updated_at: datetime = Field(description="Last update timestamp.")

    @model_validator(mode="after")
    def _check_grounding(self) -> "ScopeItem":
        if self.updated_by is UpdatedBy.AI and (errors := self.grounding_errors()):
            raise ValueError("; ".join(errors))
        return self


class ScopeItemCreate(ScopeItemBase):
    """User-created item; the id is assigned by the server from the type prefix."""


class ScopeItemUpdate(DomainModel):
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    origin: Origin | None = None
    status: ItemStatus | None = None
    source_refs: list[SourceRef] | None = None
    related_ids: list[str] | None = None
    tags: list[str] | None = None
    notes: str | None = None
    absence_note: str | None = None
    details: ScopeItemDetails | None = None


class TeamSizeEntry(DomainModel):
    workstream_type: str = Field(description="Workstream type the team size applies to.")
    team_size: float = Field(gt=0, description="People working on that workstream in parallel.")


class RoleRate(DomainModel):
    role: str = Field(min_length=1, description="Role or skill category.")
    rate_per_person_week: float = Field(ge=0, description="Rate for one person-week of that role.")


class SessionConfig(DomainModel):
    """Estimation and solution inputs held on the session (PLAN sections 2 and 5)."""

    rate_card_id: str = Field(
        default="", description="Selected rate card; it carries the currency."
    )
    rate_overrides: list[RoleRate] = Field(
        default_factory=list,
        description="Per-role rates that replace the card's rate for this session only.",
    )
    expected_users: int | None = Field(
        default=None, ge=0, description="Expected user volume; missing volume reduces confidence."
    )
    target_regions: list[str] = Field(
        default_factory=list, description="Regions the solution must serve."
    )
    delivery_deadline: date | None = Field(
        default=None, description="Required delivery date, when the customer stated one."
    )
    security_level: SecurityLevel = Field(
        default=SecurityLevel.STANDARD, description="Security and compliance level."
    )
    regulatory_constraints: list[str] = Field(
        default_factory=list, description="Regulations such as GDPR, HIPAA or PCI-DSS."
    )
    ai_provider_preference: AiProviderPreference | None = Field(
        default=None, description="Customer preference for the AI provider."
    )
    contingency_pct: float = Field(
        default=15.0,
        ge=0,
        le=100,
        description="Contingency percentage applied once to the ROM range, 15 means 15%.",
    )
    blended_rate_mode: BlendedRateMode = Field(
        default=BlendedRateMode.ROLE_MIX, description="How the blended rate is derived."
    )
    explicit_blended_rate: float | None = Field(
        default=None, ge=0, description="Blended rate per person-week when mode is explicit."
    )
    productivity_factor: float = Field(
        default=1.0, ge=0.5, le=1.2, description="Productivity assumption used for the timeline."
    )
    working_weeks_per_month: float = Field(
        default=4.0, gt=0, description="Working weeks per month used for timeline reporting."
    )
    environments_count: int = Field(
        default=3, ge=1, description="Number of environments (dev, test, prod, ...)."
    )
    testing_level: TestingLevel = Field(
        default=TestingLevel.STANDARD, description="Testing depth required."
    )
    data_migration: DataMigration = Field(
        default=DataMigration.NONE, description="Data migration or transformation effort."
    )
    team_sizes: list[TeamSizeEntry] = Field(
        default_factory=list, description="Team size overrides per workstream type."
    )


class SessionCreate(DomainModel):
    name: str = Field(min_length=1, description="Session name.")
    customer_name: str = Field(default="", description="Customer or account name.")
    opportunity_context: str = Field(default="", description="Free-text opportunity context.")
    cloud_platform: CloudPlatform | None = Field(
        default=None, description="Selected cloud platform; null asks for a recommendation."
    )
    platform_mode: PlatformMode = Field(
        default=PlatformMode.SELECTED,
        description="Whether the platform is selected or recommended.",
    )
    config: SessionConfig = Field(
        default_factory=SessionConfig, description="Estimation and solution inputs."
    )


class SessionUpdate(DomainModel):
    name: str | None = None
    customer_name: str | None = None
    opportunity_context: str | None = None
    cloud_platform: CloudPlatform | None = None
    platform_mode: PlatformMode | None = None
    config: SessionConfig | None = None


class SessionRead(DomainModel):
    id: str = Field(description="Session id.")
    name: str = Field(description="Session name.")
    customer_name: str = Field(description="Customer or account name.")
    opportunity_context: str = Field(description="Free-text opportunity context.")
    cloud_platform: CloudPlatform | None = Field(description="Selected cloud platform.")
    platform_mode: PlatformMode = Field(description="Selected or recommended platform.")
    config: SessionConfig = Field(description="Estimation and solution inputs.")
    scope_version: int = Field(description="Current scope version.")
    scope_status: ScopeStatus = Field(description="empty, analyzed or approved.")
    ai_mode: str = Field(description="AI mode used for this session: mock or live.")
    scenario_slug: str = Field(default="", description="Seeded scenario the session came from.")
    created_at: datetime = Field(description="Creation timestamp.")
    updated_at: datetime = Field(description="Last update timestamp.")
