"""Applies the mutation one change asks for, through the normal scope and session services.

Each service returns the before/after of what it touched, so the change record can
say exactly which values moved. `allow_locked=True` is what the approved scope allows
here: the impact is recorded by the caller.
"""

from typing import Any

from sqlalchemy.orm import Session as DbSession

from app.core.errors import ValidationFailed
from app.db.models import Session as SessionRow
from app.domain.changes import ChangeRequest, ChangeType, ChangeValue
from app.domain.scope import SessionUpdate
from app.scope import service as scope_service
from app.scope.models import ItemChange
from app.sessions.service import update_session
from app.workflow import estimate as estimate_service

_ITEM_TYPES = (
    ChangeType.SCOPE_ITEM_EDIT,
    ChangeType.SCOPE_ITEM_PRIORITY,
    ChangeType.SCOPE_ITEM_STATUS,
)


def diff(before: dict[str, Any], after: dict[str, Any], prefix: str = "") -> list[ChangeValue]:
    return [
        ChangeValue(key=f"{prefix}{key}", old_value=str(before.get(key)), new_value=str(value))
        for key, value in after.items()
        if before.get(key) != value
    ]


def item_values(change: ItemChange) -> list[ChangeValue]:
    before = change.before.model_dump(mode="json") if change.before else {}
    after = change.after.model_dump(mode="json") if change.after else {}
    if not after:  # a removal: report the fields that are gone
        return [ChangeValue(key="status", old_value=str(before.get("status")), new_value="removed")]
    return diff(before, after)


def first_id(request: ChangeRequest) -> str:
    if not request.item_ids:
        raise ValidationFailed("Name the scope item this change is about in 'item_ids'.")
    return request.item_ids[0]


def apply_mutation(
    db: DbSession, session: SessionRow, request: ChangeRequest
) -> tuple[list[str], list[ChangeValue]]:
    """Run the change through the normal services, which return before/after."""
    if request.change_type in _ITEM_TYPES:
        if request.item_update is None:
            raise ValidationFailed("Send the new field values in 'item_update'.")
        item_id = first_id(request)
        change = scope_service.update_item(
            db, session, item_id, request.item_update, allow_locked=True
        )
        return [item_id], item_values(change)
    if request.change_type is ChangeType.SCOPE_ITEM_ADDED:
        if request.item_create is None:
            raise ValidationFailed("Send the new item in 'item_create'.")
        change = scope_service.create_item(db, session, request.item_create, allow_locked=True)
        added = change.after.id if change.after else ""
        return [added], [ChangeValue(key="status", old_value="absent", new_value="added")]
    if request.change_type is ChangeType.SCOPE_ITEM_REMOVED:
        item_id = first_id(request)
        change = scope_service.delete_item(db, session, item_id, allow_locked=True)
        return [item_id], item_values(change)
    if request.change_type is ChangeType.ASSUMPTION_DECISION:
        if request.confirmed is None:
            raise ValidationFailed("Set 'confirmed' to true or false.")
        item_id = first_id(request)
        change = scope_service.decide_assumption(
            db, session, item_id, confirmed=request.confirmed, allow_locked=True
        )
        return [item_id], item_values(change)
    if request.change_type is ChangeType.QUESTION_ANSWERED:
        if not request.answer.strip():
            raise ValidationFailed("Send the recorded answer in 'answer'.")
        item_id = first_id(request)
        change = scope_service.answer_question(
            db, session, item_id, request.answer, allow_locked=True
        )
        return [item_id], item_values(change)
    if request.change_type is ChangeType.CONFIG_CHANGE:
        return [], apply_config(db, session, request)
    if request.change_type is ChangeType.UNIT_COMPLEXITY:
        if not request.unit_complexity:
            raise ValidationFailed("Send the new complexity per unit in 'unit_complexity'.")
        drivers = estimate_service.load_drivers(db, session.id)
        before = {unit.unit_id: unit.complexity for unit in drivers.units}
        estimate_service.apply_unit_complexity(db, session, request.unit_complexity)
        return [override.unit_id for override in request.unit_complexity], [
            ChangeValue(
                key=f"complexity.{override.unit_id}",
                old_value=str(before.get(override.unit_id)),
                new_value=override.complexity.value,
            )
            for override in request.unit_complexity
        ]
    raise ValidationFailed(f"'{request.change_type.value}' is not a change this API applies.")


def apply_config(db: DbSession, session: SessionRow, request: ChangeRequest) -> list[ChangeValue]:
    if request.config is None and not request.platform_change:
        raise ValidationFailed("Send the new 'config', the new 'cloud_platform', or both.")
    before_config = dict(session.config)
    before_platform = session.cloud_platform or ""
    fields: dict[str, Any] = {}
    if request.config is not None:
        fields["config"] = request.config
    if request.platform_change:
        fields["cloud_platform"] = request.cloud_platform
    update_session(db, session, SessionUpdate(**fields), allow_locked=True)
    values = diff(before_config, dict(session.config), prefix="config.")
    if (session.cloud_platform or "") != before_platform:
        values.append(
            ChangeValue(
                key="cloud_platform",
                old_value=before_platform,
                new_value=session.cloud_platform or "",
            )
        )
    return values
