"""Change-impact models (PLAN section 7). Models only; rules live in `app/change_impact`."""

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.domain.artifacts import ArtifactKind, Complexity
from app.domain.base import DomainModel
from app.domain.scope import (
    CloudPlatform,
    ScopeItemCreate,
    ScopeItemUpdate,
    SessionConfig,
)


class ChangeType(StrEnum):
    SCOPE_ITEM_EDIT = "scope_item_edit"
    SCOPE_ITEM_PRIORITY = "scope_item_priority"
    SCOPE_ITEM_STATUS = "scope_item_status"
    SCOPE_ITEM_ADDED = "scope_item_added"
    SCOPE_ITEM_REMOVED = "scope_item_removed"
    ASSUMPTION_DECISION = "assumption_decision"
    QUESTION_ANSWERED = "question_answered"
    CONFIG_CHANGE = "config_change"
    UNIT_COMPLEXITY = "unit_complexity"


class ImpactAction(StrEnum):
    """What has to happen to the affected output."""

    REGENERATE = "regenerate"  # AI produces the content again; artifact becomes stale
    RECALCULATE = "recalculate"  # deterministic recomputation; artifact becomes stale
    RELINK = "relink"  # references resolved against new content; artifact stays fresh


class ChangeValue(DomainModel):
    key: str = Field(description="Field or config key that changed.")
    old_value: str = Field(description="Value before the change, as text.")
    new_value: str = Field(description="Value after the change, as text.")


class UnitComplexityOverride(DomainModel):
    unit_id: str = Field(description="Estimate unit the reviewer re-rated, e.g. CAP_01.")
    complexity: Complexity = Field(description="Complexity the reviewer chose.")


class ChangeRequest(DomainModel):
    """The change the reviewer asks for: what kind, and the new value it carries."""

    change_type: ChangeType = Field(description="What kind of change the user made.")
    description: str = Field(default="", description="Human-readable description of the change.")
    item_ids: list[str] = Field(
        default_factory=list, description="Scope item or unit ids affected by the change."
    )
    values: list[ChangeValue] = Field(
        default_factory=list,
        description="Changed fields with old and new values; filled in when the change is applied.",
    )
    item_update: ScopeItemUpdate | None = Field(
        default=None, description="New field values for an edit, priority or status change."
    )
    item_create: ScopeItemCreate | None = Field(
        default=None, description="The item to add, for a scope_item_added change."
    )
    answer: str = Field(default="", description="Answer recorded for a question.")
    confirmed: bool | None = Field(
        default=None, description="True confirms an assumption, false rejects it."
    )
    config: SessionConfig | None = Field(
        default=None, description="The full new session config, for a config change."
    )
    cloud_platform: CloudPlatform | None = Field(
        default=None, description="New cloud platform; only read when platform_change is true."
    )
    platform_change: bool = Field(
        default=False,
        description="True when cloud_platform is part of the change; it may be set to null.",
    )
    unit_complexity: list[UnitComplexityOverride] = Field(
        default_factory=list, description="Per-unit complexity overrides for the estimate."
    )


class ImpactEntry(DomainModel):
    artifact: ArtifactKind = Field(description="Artifact affected by the change.")
    element_ids: list[str] = Field(
        default_factory=list, description="Elements inside the artifact that are affected."
    )
    reason: str = Field(description="Why these elements are affected.")
    action: ImpactAction = Field(
        default=ImpactAction.REGENERATE, description="regenerate, recalculate or relink."
    )


class ChangeRecord(DomainModel):
    id: str = Field(description="Change record id.")
    session_id: str = Field(description="Session the change belongs to.")
    scope_version: int = Field(description="Scope version created by this change.")
    request: ChangeRequest = Field(description="The change that was applied.")
    affected: list[ImpactEntry] = Field(default_factory=list, description="Affected outputs.")
    affected_item_ids: list[str] = Field(
        default_factory=list, description="Scope items affected by the change."
    )
    stale_kinds: list[ArtifactKind] = Field(
        default_factory=list, description="Artifact kinds to mark stale, in regeneration order."
    )
    coverage_affected: bool = Field(
        default=False, description="True when the coverage view has to be recomputed."
    )
    quality_gate_affected: bool = Field(
        default=True, description="True when the quality gate has to be run again."
    )
    unaffected_summary: list[str] = Field(
        default_factory=list, description="Major areas that stay untouched."
    )
    suggested_actions: list[str] = Field(
        default_factory=list, description="What the reviewer should do next."
    )
    narrative: str = Field(
        default="", description="Optional AI explanation, labelled as generated."
    )
    created_at: datetime = Field(description="When the change was applied.")
