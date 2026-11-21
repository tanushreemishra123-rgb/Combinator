"""Deterministic change-impact rules (PLAN section 7, documented in docs/CHANGE_IMPACT.md)."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from app.change_impact.models import SessionState
from app.domain.artifacts import ArchitectureArea, ArtifactKind
from app.domain.changes import ImpactAction, ImpactEntry
from app.domain.scope import ItemType, NfrCategory, ScopeItem
from app.traceability.index import TraceIndex, iter_elements, string_list

# Dependency order used for regeneration and for ordering the affected list.
REGENERATION_ORDER: tuple[ArtifactKind, ...] = (
    ArtifactKind.PRD,
    ArtifactKind.FUNCTIONAL_SCOPE,
    ArtifactKind.PLATFORM_RECOMMENDATION,
    ArtifactKind.ARCHITECTURE,
    ArtifactKind.DATA_STRATEGY,
    ArtifactKind.INTEGRATION_ARCHITECTURE,
    ArtifactKind.AI_STRATEGY,
    ArtifactKind.ESTIMATE_DRIVERS,
    ArtifactKind.ESTIMATE,
    ArtifactKind.EXECUTIVE_SUMMARY,
)

# Plain names for the UI's affected / unaffected lists.
ARTIFACT_LABELS: dict[ArtifactKind, str] = {
    ArtifactKind.PRD: "PRD and customer objectives",
    ArtifactKind.FUNCTIONAL_SCOPE: "Functional scope and capabilities",
    ArtifactKind.PLATFORM_RECOMMENDATION: "Platform recommendation",
    ArtifactKind.ARCHITECTURE: "Solution architecture",
    ArtifactKind.DATA_STRATEGY: "Data strategy",
    ArtifactKind.INTEGRATION_ARCHITECTURE: "Integration architecture",
    ArtifactKind.AI_STRATEGY: "AI solution approach",
    ArtifactKind.ESTIMATE_DRIVERS: "Delivery phases and workstreams",
    ArtifactKind.ESTIMATE: "Effort, timeline and ROM",
    ArtifactKind.EXECUTIVE_SUMMARY: "Executive summary",
}

# Named parts of the estimate, used where an element id would be meaningless.
ROM = "rom"
EFFORT = "effort"
TIMELINE = "timeline"
CONFIDENCE = "overall_confidence"

# Which parts of the estimate each commercial or delivery input moves (docs/ESTIMATION.md).
# Prices move only the ROM; effort inputs move effort, timeline and ROM; team and
# productivity inputs move the timeline only.
ESTIMATE_PARTS_BY_KEY: dict[str, tuple[str, ...]] = {
    "rate_card_id": (ROM,),
    "rate_overrides": (ROM,),
    "currency": (ROM,),
    "contingency_pct": (ROM,),
    "blended_rate_mode": (ROM,),
    "explicit_blended_rate": (ROM,),
    "productivity_factor": (TIMELINE,),
    "working_weeks_per_month": (TIMELINE,),
    "team_sizes": (TIMELINE,),
    "environments_count": (EFFORT, TIMELINE, ROM),
    "testing_level": (EFFORT, TIMELINE, ROM),
    "data_migration": (EFFORT, TIMELINE, ROM),
}

# Areas that react to user volume (PLAN section 7).
SCALING_AREAS: frozenset[ArchitectureArea] = frozenset(
    {
        ArchitectureArea.USER_FACING_APPLICATIONS,
        ArchitectureArea.BACKEND_SERVICES,
        ArchitectureArea.APIS,
        ArchitectureArea.DATABASES_AND_STORAGE,
        ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING,
        ArchitectureArea.AVAILABILITY_AND_SCALABILITY,
    }
)

# Identity is a security control in practice, so it moves with the security level.
SECURITY_AREAS: frozenset[ArchitectureArea] = frozenset(
    {
        ArchitectureArea.SECURITY_CONTROLS,
        ArchitectureArea.IDENTITY_AND_ACCESS_MANAGEMENT,
    }
)

AI_AREAS: frozenset[ArchitectureArea] = frozenset({ArchitectureArea.AI_AND_ML_SERVICES})

# Where data lives and fails over follows the target regions; the estimate does not read them.
REGION_AREAS: frozenset[ArchitectureArea] = frozenset(
    {
        ArchitectureArea.DATABASES_AND_STORAGE,
        ArchitectureArea.AVAILABILITY_AND_SCALABILITY,
        ArchitectureArea.BACKUP_AND_DISASTER_RECOVERY,
    }
)

SCALING_TAGS = ("scalability", "performance")
SCALING_NFR_CATEGORIES = (NfrCategory.SCALABILITY, NfrCategory.PERFORMANCE)

PRIVACY_SECTIONS = ("privacy_security",)

# Config keys that only move numbers in the estimate.
ESTIMATE_ONLY_KEYS: frozenset[str] = frozenset(
    {
        "rate_card_id",
        "rate_overrides",
        "currency",
        "contingency_pct",
        "blended_rate_mode",
        "explicit_blended_rate",
        "productivity_factor",
        "working_weeks_per_month",
        "environments_count",
        "testing_level",
        "data_migration",
        "team_sizes",
    }
)

_TESTING_WORKSTREAM_HINT = "testing"


class UnknownChange(Exception):
    """Raised when a change carries no ids and no config difference to act on."""


@dataclass
class _Entry:
    element_ids: dict[str, None] = field(default_factory=dict)
    reasons: dict[str, None] = field(default_factory=dict)


class ImpactBuilder:
    """Collects affected outputs, merged per artifact and action."""

    def __init__(self, state: SessionState, index: TraceIndex) -> None:
        self.state = state
        self.index = index
        self.item_ids: dict[str, None] = {}
        self.coverage_affected = False
        self._entries: dict[tuple[ArtifactKind, ImpactAction], _Entry] = {}

    def has(self, kind: ArtifactKind) -> bool:
        return kind in self.state.artifacts

    def add(
        self,
        kind: ArtifactKind,
        element_ids: Iterable[str],
        reason: str,
        action: ImpactAction,
    ) -> None:
        """Record affected elements; artifacts the session does not have are skipped."""
        if not self.has(kind):
            return
        entry = self._entries.setdefault((kind, action), _Entry())
        for element_id in element_ids:
            entry.element_ids.setdefault(element_id, None)
        entry.reasons.setdefault(reason, None)

    def add_items(self, item_ids: Iterable[str]) -> None:
        for item_id in item_ids:
            self.item_ids.setdefault(item_id, None)

    def affected_kinds(self) -> set[ArtifactKind]:
        return {kind for kind, _action in self._entries}

    def outputs(self) -> list[ImpactEntry]:
        def sort_key(item: tuple[tuple[ArtifactKind, ImpactAction], _Entry]) -> tuple[int, str]:
            (kind, action), _entry = item
            unknown = len(REGENERATION_ORDER)
            position = REGENERATION_ORDER.index(kind) if kind in REGENERATION_ORDER else unknown
            return position, action.value

        return [
            ImpactEntry(
                artifact=kind,
                element_ids=list(entry.element_ids),
                reason="; ".join(entry.reasons),
                action=action,
            )
            for (kind, action), entry in sorted(self._entries.items(), key=sort_key)
        ]


# --- helpers -----------------------------------------------------------------


def components_in_areas(state: SessionState, areas: frozenset[ArchitectureArea]) -> list[str]:
    """Architecture component ids in the given areas."""
    wanted = {area.value for area in areas}
    return [
        element_id
        for element_id, element in iter_elements(
            state.artifacts, ArtifactKind.ARCHITECTURE, "components"
        )
        if element.get("area") in wanted
    ]


def all_component_ids(state: SessionState) -> list[str]:
    return [
        element_id
        for element_id, _element in iter_elements(
            state.artifacts, ArtifactKind.ARCHITECTURE, "components"
        )
    ]


def arc_linked_elements(index: TraceIndex, kind: ArtifactKind) -> list[str]:
    """Elements of `kind` whose `arc_ids` field points at architecture components."""
    seen: dict[str, None] = {}
    for ref in index.refs:
        if ref.artifact is kind and ref.field == "arc_ids":
            seen.setdefault(ref.element_id, None)
    return list(seen)


def workstreams_containing(
    state: SessionState, element_ids: Sequence[str]
) -> dict[ArtifactKind, list[str]]:
    """Workstreams that contain any of the given elements, per artifact."""
    wanted = set(element_ids)
    result: dict[ArtifactKind, list[str]] = {
        ArtifactKind.FUNCTIONAL_SCOPE: [],
        ArtifactKind.ESTIMATE_DRIVERS: [],
    }
    for element_id, element in iter_elements(
        state.artifacts, ArtifactKind.FUNCTIONAL_SCOPE, "workstreams"
    ):
        if set(string_list(element.get("capability_ids"))) & wanted:
            result[ArtifactKind.FUNCTIONAL_SCOPE].append(element_id)
    member_fields = (
        "capability_ids",
        "integration_ids",
        "ai_use_case_ids",
        "arc_ids",
        "domain_ids",
        "req_ids",
    )
    for element_id, element in iter_elements(
        state.artifacts, ArtifactKind.ESTIMATE_DRIVERS, "workstreams"
    ):
        members: set[str] = set()
        for name in member_fields:
            members.update(string_list(element.get(name)))
        if members & wanted:
            result[ArtifactKind.ESTIMATE_DRIVERS].append(element_id)
    return result


def testing_workstream_ids(state: SessionState) -> list[str]:
    """Workstreams whose name marks them as the testing workstream."""
    return [
        element_id
        for element_id, element in iter_elements(
            state.artifacts, ArtifactKind.ESTIMATE_DRIVERS, "workstreams"
        )
        if _TESTING_WORKSTREAM_HINT in str(element.get("name", "")).lower()
    ]


def scaling_item_ids(items: Sequence[ScopeItem]) -> list[str]:
    """NFR items tagged or categorised as scalability or performance."""
    found: list[str] = []
    for item in items:
        if item.type is not ItemType.NON_FUNCTIONAL_REQUIREMENT:
            continue
        nfr = item.details.nfr
        tagged = any(tag in SCALING_TAGS for tag in item.tags)
        categorised = nfr is not None and nfr.category in SCALING_NFR_CATEGORIES
        if tagged or categorised:
            found.append(item.id)
    return found


def security_item_ids(items: Sequence[ScopeItem]) -> list[str]:
    return [item.id for item in items if item.type is ItemType.SECURITY_COMPLIANCE]


# --- rules -------------------------------------------------------------------


def apply_item_change(builder: ImpactBuilder, item_ids: Sequence[str], reason: str) -> None:
    """Everything referencing the changed ids, the workstreams holding it, the estimate."""
    builder.add_items(item_ids)
    touched: dict[ArtifactKind, dict[str, None]] = {}
    for item_id in item_ids:
        for ref in builder.index.references(item_id):
            touched.setdefault(ref.artifact, {}).setdefault(ref.element_id, None)

    for kind, elements in touched.items():
        action = (
            ImpactAction.RECALCULATE
            if kind in (ArtifactKind.ESTIMATE, ArtifactKind.ESTIMATE_DRIVERS)
            else ImpactAction.REGENERATE
        )
        builder.add(kind, elements, reason, action)

    element_ids = [element for elements in touched.values() for element in elements]
    workstreams = workstreams_containing(builder.state, element_ids)
    builder.add(
        ArtifactKind.FUNCTIONAL_SCOPE,
        workstreams[ArtifactKind.FUNCTIONAL_SCOPE],
        "workstreams holding the affected capabilities",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.ESTIMATE,
        [*workstreams[ArtifactKind.ESTIMATE_DRIVERS], ROM],
        "effort and ROM follow the changed requirements",
        ImpactAction.RECALCULATE,
    )


def apply_scope_inclusion(builder: ImpactBuilder, item_ids: Sequence[str]) -> None:
    """Including or excluding scope also moves the functional scope and coverage."""
    builder.coverage_affected = True
    builder.add_items(item_ids)
    builder.add(
        ArtifactKind.FUNCTIONAL_SCOPE,
        [],
        "capabilities and workstreams change with the scope",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.ESTIMATE,
        [ROM],
        "effort and ROM change with the scope",
        ImpactAction.RECALCULATE,
    )


def apply_cloud_platform(builder: ImpactBuilder) -> None:
    builder.add(
        ArtifactKind.ARCHITECTURE,
        all_component_ids(builder.state),
        "every component is mapped to services of the new platform",
        ImpactAction.REGENERATE,
    )
    for kind in (ArtifactKind.DATA_STRATEGY, ArtifactKind.INTEGRATION_ARCHITECTURE):
        builder.add(
            kind,
            arc_linked_elements(builder.index, kind),
            "component references are re-linked to the new architecture",
            ImpactAction.RELINK,
        )
    builder.add(
        ArtifactKind.AI_STRATEGY,
        ["provider_options", "framework_recommendations"],
        "provider options are re-linked to the new platform",
        ImpactAction.RELINK,
    )
    arc_ids = all_component_ids(builder.state)
    workstreams = workstreams_containing(builder.state, arc_ids)
    builder.add(
        ArtifactKind.ESTIMATE,
        [*workstreams[ArtifactKind.ESTIMATE_DRIVERS], ROM],
        "infrastructure effort and ROM follow the platform",
        ImpactAction.RECALCULATE,
    )


def apply_expected_users(builder: ImpactBuilder) -> None:
    builder.add_items(scaling_item_ids(builder.state.items))
    builder.add(
        ArtifactKind.ARCHITECTURE,
        components_in_areas(builder.state, SCALING_AREAS),
        "components that carry user volume are resized",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.ESTIMATE,
        [*testing_workstream_ids(builder.state), ROM],
        "performance testing effort and ROM follow the user volume",
        ImpactAction.RECALCULATE,
    )


def apply_delivery_deadline(builder: ImpactBuilder) -> None:
    builder.add(
        ArtifactKind.ESTIMATE,
        [TIMELINE, CONFIDENCE],
        "timeline and confidence only",
        ImpactAction.RECALCULATE,
    )


def apply_commercial(builder: ImpactBuilder, key: str) -> None:
    parts = ESTIMATE_PARTS_BY_KEY.get(key, (EFFORT, TIMELINE, ROM))
    builder.add(
        ArtifactKind.ESTIMATE,
        list(parts),
        f"{key} only changes the calculated estimate",
        ImpactAction.RECALCULATE,
    )


def apply_security(builder: ImpactBuilder) -> None:
    builder.add_items(security_item_ids(builder.state.items))
    builder.add(
        ArtifactKind.ARCHITECTURE,
        components_in_areas(builder.state, SECURITY_AREAS),
        "security controls follow the security level and regulations",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.DATA_STRATEGY,
        list(PRIVACY_SECTIONS),
        "data privacy sections follow the security level and regulations",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.ESTIMATE,
        [ROM],
        "the security factor changes the effort",
        ImpactAction.RECALCULATE,
    )


def apply_target_regions(builder: ImpactBuilder) -> None:
    builder.add(
        ArtifactKind.ARCHITECTURE,
        components_in_areas(builder.state, REGION_AREAS),
        "data residency, regional availability and recovery follow the target regions",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.DATA_STRATEGY,
        list(PRIVACY_SECTIONS),
        "data residency follows the target regions",
        ImpactAction.REGENERATE,
    )


def apply_ai_provider(builder: ImpactBuilder) -> None:
    builder.add(
        ArtifactKind.AI_STRATEGY,
        ["provider_options", "framework_recommendations"],
        "provider and framework recommendations follow the preference",
        ImpactAction.REGENERATE,
    )
    builder.add(
        ArtifactKind.ARCHITECTURE,
        components_in_areas(builder.state, AI_AREAS),
        "AI components follow the provider preference",
        ImpactAction.REGENERATE,
    )


def apply_unit_complexity(builder: ImpactBuilder, unit_ids: Sequence[str]) -> None:
    workstreams = workstreams_containing(builder.state, unit_ids)
    builder.add(
        ArtifactKind.ESTIMATE,
        [*unit_ids, *workstreams[ArtifactKind.ESTIMATE_DRIVERS], EFFORT, TIMELINE, ROM],
        "unit complexity changes the calculated effort, timeline and ROM",
        ImpactAction.RECALCULATE,
    )


def apply_config_key(builder: ImpactBuilder, key: str) -> None:
    """Route one changed configuration key to its rule."""
    if key == "cloud_platform":
        apply_cloud_platform(builder)
    elif key == "expected_users":
        apply_expected_users(builder)
    elif key == "delivery_deadline":
        apply_delivery_deadline(builder)
    elif key in ("security_level", "regulatory_constraints"):
        apply_security(builder)
    elif key == "target_regions":
        apply_target_regions(builder)
    elif key == "ai_provider_preference":
        apply_ai_provider(builder)
    elif key in ESTIMATE_ONLY_KEYS:
        apply_commercial(builder, key)
    else:
        raise UnknownChange(f"no change-impact rule for configuration key '{key}'")


def regeneration_order(stale_kinds: Iterable[ArtifactKind]) -> list[ArtifactKind]:
    """Stale artifacts in dependency order; unknown kinds keep their input order at the end."""
    stale = list(dict.fromkeys(stale_kinds))
    known = [kind for kind in REGENERATION_ORDER if kind in stale]
    rest = [kind for kind in stale if kind not in REGENERATION_ORDER]
    return known + rest
