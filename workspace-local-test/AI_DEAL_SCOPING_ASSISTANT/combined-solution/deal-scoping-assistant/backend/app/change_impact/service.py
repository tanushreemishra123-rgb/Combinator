"""Turns one change into a `ChangeRecord`: affected, unaffected, stale, next steps."""

import re
from collections.abc import Sequence
from datetime import datetime

from app.change_impact import rules
from app.change_impact.models import SessionState
from app.change_impact.rules import ARTIFACT_LABELS, ImpactBuilder, UnknownChange
from app.domain.artifacts import ArtifactKind
from app.domain.changes import ChangeRecord, ChangeRequest, ChangeType, ImpactAction
from app.domain.scope import Priority, ScopeItem
from app.traceability.index import build_index

# Change type -> how the affected elements are described to the reviewer.
_ITEM_REASONS: dict[ChangeType, str] = {
    ChangeType.SCOPE_ITEM_EDIT: "references the edited requirement",
    ChangeType.SCOPE_ITEM_PRIORITY: "references the re-prioritised requirement",
    ChangeType.SCOPE_ITEM_STATUS: "references the requirement whose status changed",
    ChangeType.SCOPE_ITEM_ADDED: "the scope now holds a requirement it did not have",
    ChangeType.SCOPE_ITEM_REMOVED: "references the requirement that was removed",
    ChangeType.ASSUMPTION_DECISION: "references the confirmed or rejected assumption",
    ChangeType.QUESTION_ANSWERED: "references the answered question",
}

_HIGH_PRIORITIES = (Priority.MUST.value, Priority.HIGH.value)

# Changes that take a requirement into or out of the delivered scope.
_INCLUSION_TYPES = (
    ChangeType.SCOPE_ITEM_STATUS,
    ChangeType.SCOPE_ITEM_ADDED,
    ChangeType.SCOPE_ITEM_REMOVED,
)

# How many untouched elements are named per partially affected artifact.
_MAX_UNAFFECTED_ELEMENTS = 6

# Keys the reviewer may name that are not `SessionConfig` fields.
_SESSION_KEYS = ("cloud_platform",)


def changed_config_keys(
    change: ChangeRequest, before: SessionState, after: SessionState
) -> list[str]:
    """Declared keys plus any real difference between the two states."""
    keys: dict[str, None] = {}
    for value in change.values:
        keys.setdefault(value.key.removeprefix("config."), None)
    if before.cloud_platform != after.cloud_platform:
        keys.setdefault("cloud_platform", None)
    before_config = before.config.model_dump()
    after_config = after.config.model_dump()
    for key, new_value in after_config.items():
        if before_config.get(key) != new_value:
            keys.setdefault(key, None)
    return list(keys)


def changed_item_ids(change: ChangeRequest, before: SessionState, after: SessionState) -> list[str]:
    """Ids named by the change, or the items that actually differ between states."""
    if change.item_ids:
        return list(dict.fromkeys(change.item_ids))
    before_items = {item.id: item.model_dump(mode="json") for item in before.items}
    after_items = {item.id: item.model_dump(mode="json") for item in after.items}
    changed = [
        item_id for item_id in after_items if before_items.get(item_id) != after_items[item_id]
    ]
    removed = [item_id for item_id in before_items if item_id not in after_items]
    return changed + removed


def _touches_high_priority(change: ChangeRequest, items: Sequence[ScopeItem]) -> bool:
    """True when a priority change moves a requirement into or out of must/high."""
    for value in change.values:
        if value.key.endswith("priority") and (
            value.old_value in _HIGH_PRIORITIES or value.new_value in _HIGH_PRIORITIES
        ):
            return True
    ids = set(change.item_ids)
    return any(item.id in ids and item.priority in (Priority.MUST, Priority.HIGH) for item in items)


def _unaffected_summary(builder: ImpactBuilder, state: SessionState) -> list[str]:
    """Major areas untouched, plus untouched elements of partly affected artifacts."""
    affected_kinds = builder.affected_kinds()
    affected_elements = {
        (output.artifact, element_id)
        for output in builder.outputs()
        for element_id in output.element_ids
    }
    summary: list[str] = []
    index = builder.index
    for kind in rules.REGENERATION_ORDER:
        if kind not in state.artifacts:
            continue
        label = ARTIFACT_LABELS[kind]
        if kind not in affected_kinds:
            summary.append(label)
            continue
        untouched = [
            element_id
            for element_id in index.element_ids(kind)
            if (kind, element_id) not in affected_elements
        ]
        if untouched:
            named = ", ".join(_readable(e) for e in untouched[:_MAX_UNAFFECTED_ELEMENTS])
            more = "" if len(untouched) <= _MAX_UNAFFECTED_ELEMENTS else ", ..."
            summary.append(f"{label} — unchanged: {named}{more}")
    return summary


_STRUCTURED_ID = re.compile(r"^[A-Z]+_\d+$")
_INDEXED_FIELD = re.compile(r"^([a-z][a-z_]*)\[(\d+)\]$")


def _readable(element_id: str) -> str:
    """Ids stay as they are; section names such as `key_risks[0]` read as words."""
    if _STRUCTURED_ID.match(element_id):
        return element_id
    indexed = _INDEXED_FIELD.match(element_id)
    if indexed:
        return f"{indexed.group(1).replace('_', ' ')} {int(indexed.group(2)) + 1}"
    return element_id.replace("_", " ")


def _suggested_actions(builder: ImpactBuilder) -> list[str]:
    actions: list[str] = []
    for output in builder.outputs():
        label = ARTIFACT_LABELS[output.artifact]
        if output.action is ImpactAction.REGENERATE:
            actions.append(f"Regenerate: {label}.")
        elif output.action is ImpactAction.RECALCULATE:
            actions.append(f"Recalculate: {label}.")
        else:
            actions.append(f"Re-link: {label}. The content stays as reviewed.")
    if builder.coverage_affected:
        actions.append("Refresh the requirement coverage view.")
    actions.append("Run the quality gate again before export.")
    return list(dict.fromkeys(actions))


def _stale_kinds(builder: ImpactBuilder) -> list[ArtifactKind]:
    """Re-linked artifacts keep their reviewed content, so they are not stale."""
    kinds = [
        output.artifact
        for output in builder.outputs()
        if output.action in (ImpactAction.REGENERATE, ImpactAction.RECALCULATE)
    ]
    return rules.regeneration_order(kinds)


def _add_summary_follow_up(builder: ImpactBuilder) -> None:
    """The executive summary restates the other artifacts, so it follows any of them."""
    # A purely commercial change only moves numbers the estimate already owns.
    kinds = builder.affected_kinds() - {
        ArtifactKind.ESTIMATE,
        ArtifactKind.ESTIMATE_DRIVERS,
        ArtifactKind.EXECUTIVE_SUMMARY,
    }
    if kinds:
        builder.add(
            ArtifactKind.EXECUTIVE_SUMMARY,
            [],
            "the summary restates the changed outputs",
            ImpactAction.REGENERATE,
        )


def analyze_change(
    change: ChangeRequest,
    before_state: SessionState,
    after_state: SessionState,
    change_id: str,
    created_at: datetime,
) -> ChangeRecord:
    """Deterministic impact of one applied change; see docs/CHANGE_IMPACT.md."""
    index = build_index(after_state.artifacts)
    builder = ImpactBuilder(after_state, index)

    if change.change_type is ChangeType.CONFIG_CHANGE:
        keys = changed_config_keys(change, before_state, after_state)
        if not keys:
            raise UnknownChange("a configuration change must name at least one changed key")
        for key in keys:
            rules.apply_config_key(builder, key)
    elif change.change_type is ChangeType.UNIT_COMPLEXITY:
        if not change.item_ids:
            raise UnknownChange("a complexity change must name the estimate unit ids")
        rules.apply_unit_complexity(builder, change.item_ids)
    else:
        item_ids = changed_item_ids(change, before_state, after_state)
        if not item_ids:
            raise UnknownChange("an item change must name at least one scope item id")
        reason = _ITEM_REASONS[change.change_type]
        rules.apply_item_change(builder, item_ids, reason)
        if change.change_type in _INCLUSION_TYPES:
            rules.apply_scope_inclusion(builder, item_ids)
        if change.change_type is ChangeType.SCOPE_ITEM_PRIORITY and _touches_high_priority(
            change, after_state.items
        ):
            builder.coverage_affected = True

    _add_summary_follow_up(builder)

    return ChangeRecord(
        id=change_id,
        session_id=after_state.session_id,
        scope_version=after_state.scope_version,
        request=change,
        affected=builder.outputs(),
        affected_item_ids=list(builder.item_ids),
        unaffected_summary=_unaffected_summary(builder, after_state),
        suggested_actions=_suggested_actions(builder),
        stale_kinds=_stale_kinds(builder),
        coverage_affected=builder.coverage_affected,
        quality_gate_affected=True,
        created_at=created_at,
    )


def regeneration_order(stale_kinds: Sequence[ArtifactKind]) -> list[ArtifactKind]:
    """Stale artifacts in dependency order (re-exported for the generation service)."""
    return rules.regeneration_order(stale_kinds)
