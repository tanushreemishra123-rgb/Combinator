"""Estimation inputs, rule tables and output models (PLAN section 5).

Models and small lookups over the seeded tables; the calculation lives in
`app/estimation`.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.domain.artifacts import Complexity, UnitType
from app.domain.base import DomainModel
from app.domain.scope import BlendedRateMode, RoleRate, SessionConfig, TeamSizeEntry


class ConfidenceLevel(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class FactorKind(StrEnum):
    SECURITY_LEVEL = "security_level"
    TESTING_LEVEL = "testing_level"
    ENVIRONMENTS = "environments"
    DATA_MIGRATION = "data_migration"


class ConfidenceSignal(StrEnum):
    """What the confidence rules look at, all of it input quality."""

    ASSUMED_SHARE = "assumed_share"
    OPEN_QUESTIONS = "open_questions"
    PENDING_ASSUMPTIONS = "pending_assumptions"
    MISSING_INFORMATION = "missing_information"


# --- Inputs ------------------------------------------------------------------


class RateCard(DomainModel):
    id: str = Field(description="Rate card id.")
    name: str = Field(description="Rate card name.")
    currency: str = Field(min_length=3, max_length=3, description="ISO currency code, e.g. USD.")
    rates: list[RoleRate] = Field(default_factory=list, description="Rate per role.")


class BaseEffortEntry(DomainModel):
    unit_type: UnitType = Field(description="Unit type the base effort applies to.")
    variant: str = Field(
        default="", description="Sub-type such as an integration pattern or architecture area."
    )
    complexity: Complexity = Field(description="Complexity level.")
    person_weeks: float = Field(ge=0, description="Base effort in person-weeks.")


class PhaseOverhead(DomainModel):
    phase: str = Field(description="Overhead workstream or phase name.")
    pct_of_build: float = Field(ge=0, description="Share of build effort added by this phase.")
    id: str = Field(default="", description="Line id for this overhead, e.g. OVH_TESTING.")
    workstream_type: str = Field(
        default="", description="Type used to pick the team size and the role mix."
    )
    phase_keywords: list[str] = Field(
        default_factory=list, description="Delivery phase names this line belongs to."
    )
    before_build: bool = Field(
        default=False,
        description="Where the line goes when no delivery phase matches: before or after build.",
    )


class FactorEntry(DomainModel):
    factor: FactorKind = Field(description="Which input the multiplier reacts to.")
    value: str = Field(description="Input value the multiplier applies to, e.g. 'regulated'.")
    multiplier: float = Field(gt=0, description="Multiplier applied to unit effort.")


class RoleMixEntry(DomainModel):
    workstream_type: str = Field(description="Workstream type the mix applies to.")
    role: str = Field(description="Role in the mix.")
    share: float = Field(ge=0, le=1, description="Share of the workstream effort for this role.")


class ConfidenceSpread(DomainModel):
    confidence: ConfidenceLevel = Field(description="Confidence level.")
    spread_pct: float = Field(ge=0, description="Range width applied around the point effort.")


class RoundingRule(DomainModel):
    confidence: ConfidenceLevel = Field(description="Confidence level.")
    nearest: int = Field(gt=0, description="Commercial values are rounded to this multiple.")


class FactorScope(DomainModel):
    factor: FactorKind = Field(description="Factor the scope applies to.")
    unit_types: list[UnitType] = Field(
        default_factory=list, description="Unit types the factor touches; empty means all of them."
    )


class ConfidenceThreshold(DomainModel):
    signal: ConfidenceSignal = Field(description="Input-quality signal being measured.")
    medium_at: float = Field(ge=0, description="Signal value that drops confidence to medium.")
    low_at: float = Field(ge=0, description="Signal value that drops confidence to low.")


class WorkstreamTypeRule(DomainModel):
    unit_type: UnitType = Field(description="Unit kind found in the workstream.")
    workstream_type: str = Field(description="Type the workstream takes when this kind dominates.")
    tie_break_rank: int = Field(ge=0, description="Lower rank wins when two kinds tie.")


class ProductivityBounds(DomainModel):
    min: float = Field(default=0.5, gt=0, description="Lowest defensible productivity factor.")
    max: float = Field(default=1.2, gt=0, description="Highest defensible productivity factor.")
    default: float = Field(default=1.0, gt=0, description="Factor used when none is given.")


class ReportingRules(DomainModel):
    """How many decimals the reported numbers keep, so precision stays supported."""

    effort_total_decimals: int = Field(default=0, ge=0, description="Decimals on total effort.")
    line_effort_decimals: int = Field(default=2, ge=0, description="Decimals on a line's effort.")
    timeline_weeks_decimals: int = Field(default=1, ge=0, description="Decimals on weeks.")


class EstimationRules(DomainModel):
    """Seeded rule tables from `seeds/config/estimation_defaults.json`."""

    base_effort: list[BaseEffortEntry] = Field(
        default_factory=list, description="Base effort per unit type, variant and complexity."
    )
    phase_overheads: list[PhaseOverhead] = Field(
        default_factory=list, description="Overhead phases as a share of build effort."
    )
    factors: list[FactorEntry] = Field(
        default_factory=list,
        description="Multipliers for security, testing, environments, migration.",
    )
    role_mix: list[RoleMixEntry] = Field(
        default_factory=list, description="Role mix per workstream type."
    )
    spreads: list[ConfidenceSpread] = Field(
        default_factory=list, description="Effort range width per confidence level."
    )
    rounding: list[RoundingRule] = Field(
        default_factory=list, description="Rounding per confidence level."
    )
    factor_scope: list[FactorScope] = Field(
        default_factory=list, description="Unit types each factor touches."
    )
    team_sizes: list[TeamSizeEntry] = Field(
        default_factory=list, description="Default people in parallel per workstream type."
    )
    confidence_thresholds: list[ConfidenceThreshold] = Field(
        default_factory=list, description="Signal values that drop confidence a level."
    )
    low_when_gap_is_critical: bool = Field(
        default=True, description="A critical missing input alone makes a workstream low."
    )
    workstream_types: list[WorkstreamTypeRule] = Field(
        default_factory=list, description="Unit kind to workstream type, with the tie-break rank."
    )
    productivity: ProductivityBounds = Field(
        default_factory=ProductivityBounds, description="Defensible productivity range."
    )
    reporting: ReportingRules = Field(
        default_factory=ReportingRules, description="Decimals kept on reported numbers."
    )

    # Lookups over the tables above; no calculation, just finding the right row.

    def base_effort_for(
        self, unit_type: UnitType, variant: str, complexity: Complexity
    ) -> float | None:
        for row in self.base_effort:
            same = (row.unit_type, row.variant, row.complexity) == (unit_type, variant, complexity)
            if same:
                return row.person_weeks
        return None

    def factor_for(self, factor: FactorKind, value: str) -> float | None:
        for row in self.factors:
            if row.factor is factor and row.value == value:
                return row.multiplier
        return None

    def factor_applies_to(self, factor: FactorKind, unit_type: UnitType) -> bool:
        """No scope row for a factor means it touches every unit type."""
        for row in self.factor_scope:
            if row.factor is factor:
                return not row.unit_types or unit_type in row.unit_types
        return True

    def spread_for(self, confidence: ConfidenceLevel) -> float | None:
        for row in self.spreads:
            if row.confidence is confidence:
                return row.spread_pct
        return None

    def rom_nearest_for(self, confidence: ConfidenceLevel) -> int | None:
        for row in self.rounding:
            if row.confidence is confidence:
                return row.nearest
        return None

    def team_size_for(self, workstream_type: str) -> float | None:
        for row in self.team_sizes:
            if row.workstream_type == workstream_type:
                return row.team_size
        return None

    def role_mix_for(self, workstream_type: str) -> list[RoleMixEntry]:
        return [row for row in self.role_mix if row.workstream_type == workstream_type]

    def threshold_for(self, signal: ConfidenceSignal) -> ConfidenceThreshold | None:
        for row in self.confidence_thresholds:
            if row.signal is signal:
                return row
        return None

    def overhead_for(self, line_id: str) -> PhaseOverhead | None:
        for row in self.phase_overheads:
            if row.id == line_id:
                return row
        return None

    def workstream_type_for(self, unit_type: UnitType) -> WorkstreamTypeRule | None:
        for row in self.workstream_types:
            if row.unit_type is unit_type:
                return row
        return None


class CommercialDefaults(DomainModel):
    """Seeded starting values for a new session (seeds/config/commercial.json)."""

    default_rate_card_id: str = Field(description="Rate card a new session starts with.")
    default_contingency_pct: float = Field(ge=0, le=100, description="Starting contingency.")
    blended_rate_mode: BlendedRateMode = Field(description="Starting rate basis.")
    notes: list[str] = Field(default_factory=list, description="Commercial ground rules.")


class HistoricalProject(DomainModel):
    """A delivered project shown next to the estimate as context; never calculated with."""

    id: str = Field(description="Reference id, e.g. HP_01.")
    title: str = Field(description="What was delivered.")
    type: str = Field(description="Kind of engagement, e.g. modernization.")
    duration_weeks: int = Field(ge=0, description="Elapsed delivery duration in weeks.")
    effort_person_weeks: int = Field(ge=0, description="Total effort in person-weeks.")
    team_size: int = Field(ge=0, description="Average team size.")
    cloud: str = Field(default="", description="Cloud platform the project ran on.")
    summary: str = Field(default="", description="What made the delivery what it was.")


class HistoricalProjects(DomainModel):
    disclaimer: str = Field(description="Says the panel is reference only.")
    projects: list[HistoricalProject] = Field(
        default_factory=list, description="Delivered projects, newest first."
    )


class EstimationConfig(DomainModel):
    """Everything the engine needs: session inputs, the rate card and the rule tables."""

    session_config: SessionConfig = Field(description="Per-session estimation inputs.")
    rate_card: RateCard | None = Field(
        default=None, description="Rate card for the session; None means no card is selected."
    )
    team_sizes: list[TeamSizeEntry] = Field(
        default_factory=list,
        description="Team size per workstream type: seeded defaults with the session overrides.",
    )
    rules: EstimationRules = Field(description="Seeded rule tables.")

    def team_size_for(self, workstream_type: str) -> float | None:
        for row in self.team_sizes:
            if row.workstream_type == workstream_type:
                return row.team_size
        return None


# --- Outputs -----------------------------------------------------------------


class TraceInput(DomainModel):
    name: str = Field(description="Input name used in the formula.")
    value: str = Field(description="Input value as shown to the reviewer.")


class TraceEntry(DomainModel):
    label: str = Field(description="What this line computes.")
    formula: str = Field(description="Formula in plain text.")
    inputs: list[TraceInput] = Field(
        default_factory=list, description="Values used in the formula."
    )
    result: float = Field(description="Result of the formula.")


class BlockedLine(DomainModel):
    label: str = Field(description="The line that cannot be calculated.")
    reason: str = Field(description="Why it is blocked, e.g. no rate for Data Engineer.")


class MissingInput(DomainModel):
    key: str = Field(description="Missing input, e.g. expected_users.")
    impact: str = Field(description="Effect on the estimate.")
    affected_components: list[str] = Field(
        default_factory=list, description="Estimate components affected by the gap."
    )


class WorkstreamEstimate(DomainModel):
    workstream_id: str = Field(description="Workstream id.")
    name: str = Field(description="Workstream name.")
    req_ids: list[str] = Field(default_factory=list, description="Requirements in the workstream.")
    roles: list[str] = Field(default_factory=list, description="Roles used for the role mix.")
    complexity: Complexity = Field(description="Derived complexity of the workstream.")
    effort_low: float = Field(ge=0, description="Low bound of the effort range in person-weeks.")
    effort_high: float = Field(ge=0, description="High bound of the effort range in person-weeks.")
    confidence: ConfidenceLevel = Field(description="Confidence in this workstream's estimate.")
    limitations: list[str] = Field(
        default_factory=list, description="What limits the confidence here."
    )
    blocked: bool = Field(default=False, description="True when the line cannot be calculated.")
    blocked_reason: str = Field(default="", description="Why the line is blocked.")
    overhead: bool = Field(
        default=False, description="True for discovery, testing and deployment overhead lines."
    )
    trace: list[TraceEntry] = Field(default_factory=list, description="Calculation trace.")


class Milestone(DomainModel):
    name: str = Field(description="Milestone name.")
    phase: str = Field(description="Phase the milestone closes.")
    week_low: float = Field(ge=0, description="Earliest week the milestone is reached.")
    week_high: float = Field(ge=0, description="Latest week the milestone is reached.")


class PhaseEstimate(DomainModel):
    name: str = Field(description="Phase name.")
    workstream_ids: list[str] = Field(default_factory=list, description="Workstreams in the phase.")
    weeks_low: float = Field(ge=0, description="Low bound of the phase duration in weeks.")
    weeks_high: float = Field(ge=0, description="High bound of the phase duration in weeks.")
    milestones: list[Milestone] = Field(
        default_factory=list, description="Milestones in the phase."
    )


class RomRange(DomainModel):
    amount_low: float = Field(ge=0, description="Low bound of the ROM commercial range.")
    amount_high: float = Field(ge=0, description="High bound of the ROM commercial range.")
    currency: str = Field(
        description="Currency taken from the rate card; empty when no card is selected."
    )
    rate_basis: str = Field(description="Blended rate basis used, role mix or explicit.")
    contingency_pct: float = Field(
        ge=0, le=100, description="Contingency percentage applied once, for example 15 for 15%."
    )


class Estimate(DomainModel):
    """Deterministic estimate; every number is reproducible from the trace."""

    workstreams: list[WorkstreamEstimate] = Field(
        default_factory=list, description="Workstream lines including overhead lines."
    )
    phases: list[PhaseEstimate] = Field(default_factory=list, description="Delivery phases.")
    effort_low: float = Field(ge=0, description="Total base effort, low bound, in person-weeks.")
    effort_high: float = Field(ge=0, description="Total base effort, high bound, in person-weeks.")
    effort_incl_contingency_low: float = Field(
        ge=0, description="Low effort including contingency, shown for information."
    )
    effort_incl_contingency_high: float = Field(
        ge=0, description="High effort including contingency, shown for information."
    )
    timeline_weeks_low: float = Field(ge=0, description="Total timeline, low bound, in weeks.")
    timeline_weeks_high: float = Field(ge=0, description="Total timeline, high bound, in weeks.")
    rom: RomRange = Field(description="ROM commercial range.")
    overall_confidence: ConfidenceLevel = Field(
        description="Lowest workstream confidence, reduced."
    )
    confidence_limitations: list[str] = Field(
        default_factory=list, description="Reasons the overall confidence is not high."
    )
    missing_inputs: list[MissingInput] = Field(
        default_factory=list, description="Inputs that are missing and what they affect."
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description="Every default the calculation used, as plain sentences.",
    )
    totals_partial: bool = Field(
        default=False, description="True when a blocked line is left out of the totals."
    )
    blocked_lines: list[BlockedLine] = Field(
        default_factory=list, description="Lines that cannot be calculated."
    )
    deadline_risk: str = Field(
        default="", description="Set when the high timeline exceeds the delivery deadline."
    )
    rate_card_id: str = Field(description="Rate card used.")
    config_hash: str = Field(description="Hash of the configuration used.")
    trace: list[TraceEntry] = Field(
        default_factory=list, description="Session-level trace entries."
    )
    calculated_at: datetime = Field(description="When the estimate was calculated.")
