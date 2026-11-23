"""Scope CRUD, question and assumption handling, approval and versioning.

Before the first approval edits are free. After it the scope is locked and every
mutation must go through the change service, so each mutating function here
returns the before/after of the item it touched: the change service applies the
mutation through these functions and builds the ChangeRecord from the result.
"""

import re
from collections.abc import Sequence
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.errors import Conflict, NotFound, ValidationFailed
from app.core.ids import next_id
from app.db.models import ScopeItem as ItemRow
from app.db.models import ScopeSnapshot as SnapshotRow
from app.db.models import Session as SessionRow
from app.domain.scope import (
    AnswerStatus,
    ConfirmationStatus,
    ItemStatus,
    ItemType,
    Origin,
    Priority,
    ScopeItem,
    ScopeItemBase,
    ScopeItemCreate,
    ScopeItemDetails,
    ScopeItemUpdate,
    ScopeStatus,
    SourceRef,
    UpdatedBy,
)
from app.scope.models import AnalyzedItem, ItemChange, ScopeGroup, ScopeView

LOCKED_HINT = (
    "The scope is approved, so this change must be recorded with its impact. "
    "Send it to POST /api/v1/sessions/{session_id}/changes instead."
)


def scope_locked(session: SessionRow) -> bool:
    """True once the scope has been approved; the API turns this into HTTP 409."""
    return session.scope_status == ScopeStatus.APPROVED.value


def ensure_editable(session: SessionRow, allow_locked: bool = False) -> None:
    """The change service passes `allow_locked=True`: it records the impact itself."""
    if scope_locked(session) and not allow_locked:
        raise Conflict(LOCKED_HINT.format(session_id=session.id))


def to_domain(row: ItemRow) -> ScopeItem:
    return ScopeItem(
        id=row.id,
        type=ItemType(row.type),
        title=row.title,
        description=row.description,
        priority=Priority(row.priority),
        origin=Origin(row.origin),
        status=ItemStatus(row.status),
        source_refs=[SourceRef.model_validate(ref) for ref in row.source_refs],
        related_ids=list(row.related_ids),
        tags=list(row.tags),
        notes=row.notes,
        absence_note=row.absence_note,
        details=ScopeItemDetails.model_validate(row.details),
        version=row.version,
        updated_by=UpdatedBy(row.updated_by),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_rows(db: DbSession, session_id: str) -> list[ItemRow]:
    statement = (
        select(ItemRow).where(ItemRow.session_id == session_id).order_by(ItemRow.type, ItemRow.id)
    )
    return list(db.scalars(statement))


def get_row(db: DbSession, session_id: str, item_id: str) -> ItemRow:
    row = db.get(ItemRow, (session_id, item_id))
    if row is None:
        raise NotFound(f"Scope item '{item_id}' was not found in this session.")
    return row


def build_view(db: DbSession, session: SessionRow) -> ScopeView:
    """The scope grouped by type, in the fixed order of the 15 categories."""
    items = [to_domain(row) for row in list_rows(db, session.id)]
    groups = [
        ScopeGroup(type=item_type, items=[item for item in items if item.type is item_type])
        for item_type in ItemType
    ]
    return ScopeView(
        session_id=session.id,
        scope_version=session.scope_version,
        scope_status=ScopeStatus(session.scope_status),
        locked=scope_locked(session),
        groups=[group for group in groups if group.items],
    )


def create_item(
    db: DbSession, session: SessionRow, payload: ScopeItemCreate, allow_locked: bool = False
) -> ItemChange:
    """User-created item: the server assigns the id and marks it user-updated."""
    ensure_editable(session, allow_locked)
    used = {row.id for row in list_rows(db, session.id)}
    row = ItemRow(
        session_id=session.id,
        id=next_id(payload.type.value, used),
        status=ItemStatus.PROPOSED.value,
        version=1,
        updated_by=UpdatedBy.USER.value,
    )
    _write_base(row, payload)
    db.add(row)
    db.commit()
    db.refresh(row)
    return ItemChange(before=None, after=to_domain(row))


def update_item(
    db: DbSession,
    session: SessionRow,
    item_id: str,
    payload: ScopeItemUpdate,
    allow_locked: bool = False,
) -> ItemChange:
    ensure_editable(session, allow_locked)
    row = get_row(db, session.id, item_id)
    before = to_domain(row)
    data: dict[str, Any] = before.model_dump()
    changes = payload.model_dump(exclude_unset=True)
    data.update(changes)
    data["version"] = before.version + 1
    data["updated_by"] = UpdatedBy.USER
    if "status" not in changes and before.status is ItemStatus.APPROVED:
        data["status"] = ItemStatus.MODIFIED
    after = _validate(data)
    _write_item(row, after)
    db.commit()
    db.refresh(row)
    return ItemChange(before=before, after=to_domain(row))


def delete_item(
    db: DbSession, session: SessionRow, item_id: str, allow_locked: bool = False
) -> ItemChange:
    ensure_editable(session, allow_locked)
    row = get_row(db, session.id, item_id)
    before = to_domain(row)
    db.delete(row)
    db.commit()
    return ItemChange(before=before, after=None)


def answer_question(
    db: DbSession,
    session: SessionRow,
    item_id: str,
    answer: str,
    allow_locked: bool = False,
) -> ItemChange:
    """Record the reviewer's answer on a Q item; related items are edited separately."""
    ensure_editable(session, allow_locked)
    row = _typed_row(db, session, item_id, ItemType.CLARIFICATION_QUESTION)
    before = to_domain(row)
    details = before.details.model_copy(deep=True)
    if details.question is None:  # pragma: no cover - the domain model guarantees it
        raise ValidationFailed(f"Item '{item_id}' has no question details.")
    details.question.answer = answer
    details.question.answer_status = AnswerStatus.ANSWERED
    return _apply_details(db, row, before, details)


def decide_assumption(
    db: DbSession,
    session: SessionRow,
    item_id: str,
    *,
    confirmed: bool,
    allow_locked: bool = False,
) -> ItemChange:
    """Confirm or reject an ASM item; a rejected assumption is also a rejected item."""
    ensure_editable(session, allow_locked)
    row = _typed_row(db, session, item_id, ItemType.ASSUMPTION)
    before = to_domain(row)
    details = before.details.model_copy(deep=True)
    if details.assumption is None:  # pragma: no cover - the domain model guarantees it
        raise ValidationFailed(f"Item '{item_id}' has no assumption details.")
    details.assumption.confirmation_status = (
        ConfirmationStatus.CONFIRMED if confirmed else ConfirmationStatus.REJECTED
    )
    status = before.status if confirmed else ItemStatus.REJECTED
    return _apply_details(db, row, before, details, status=status)


def approve_scope(db: DbSession, session: SessionRow) -> ScopeView:
    """First approval: proposed items become approved, the version is bumped, a snapshot stored."""
    ensure_editable(session)
    rows = list_rows(db, session.id)
    if not rows:
        raise Conflict("There is nothing to approve; analyze the documents or add scope items.")
    for row in rows:
        if row.status == ItemStatus.PROPOSED.value:
            row.status = ItemStatus.APPROVED.value
    session.scope_version += 1
    session.scope_status = ScopeStatus.APPROVED.value
    db.add(
        SnapshotRow(
            session_id=session.id,
            scope_version=session.scope_version,
            items=[to_domain(row).model_dump(mode="json") for row in rows],
            reason="scope approved",
        )
    )
    db.commit()
    db.refresh(session)
    return build_view(db, session)


def replace_analysis(
    db: DbSession, session: SessionRow, items: Sequence[AnalyzedItem]
) -> list[ScopeItem]:
    """Store a fresh AI extraction. Allowed only before the first approval."""
    if scope_locked(session):
        raise Conflict(
            "An approved scope cannot be replaced by a new analysis; record the change with "
            f"POST /api/v1/sessions/{session.id}/changes."
        )
    if not items:
        raise ValidationFailed("The analysis returned no scope items.")
    for row in list_rows(db, session.id):
        db.delete(row)
    db.flush()
    used: set[str] = set()
    rows: list[ItemRow] = []
    for item in items:
        item_id = _analysis_id(item, used)
        used.add(item_id)
        row = ItemRow(
            session_id=session.id,
            id=item_id,
            status=ItemStatus.PROPOSED.value,
            version=1,
            updated_by=UpdatedBy.AI.value,
        )
        _write_base(row, item)
        db.add(row)
        rows.append(row)
    session.scope_status = ScopeStatus.ANALYZED.value
    db.commit()
    return [to_domain(row) for row in rows]


def _analysis_id(item: AnalyzedItem, used: set[str]) -> str:
    """Keep the id the stage proposed when it is well formed, so its cross-references hold."""
    prefix = item.type.value
    proposed = item.id.strip()
    if proposed not in used and re.fullmatch(rf"{prefix}_\d{{2,}}", proposed):
        return proposed
    return next_id(prefix, used)


def _typed_row(db: DbSession, session: SessionRow, item_id: str, expected: ItemType) -> ItemRow:
    row = get_row(db, session.id, item_id)
    if row.type != expected.value:
        raise ValidationFailed(f"Item '{item_id}' is a {row.type} item, not {expected.value}.")
    return row


def _apply_details(
    db: DbSession,
    row: ItemRow,
    before: ScopeItem,
    details: ScopeItemDetails,
    status: ItemStatus | None = None,
) -> ItemChange:
    data: dict[str, Any] = before.model_dump()
    data["details"] = details.model_dump()
    data["version"] = before.version + 1
    data["updated_by"] = UpdatedBy.USER
    data["status"] = status if status is not None else before.status
    _write_item(row, _validate(data))
    db.commit()
    db.refresh(row)
    return ItemChange(before=before, after=to_domain(row))


def _validate(data: dict[str, Any]) -> ScopeItem:
    try:
        return ScopeItem.model_validate(data)
    except ValidationError as exc:
        messages = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
        raise ValidationFailed("The item would break a scope rule.", messages) from exc


def _write_base(row: ItemRow, item: ScopeItemBase) -> None:
    row.type = item.type.value
    row.title = item.title
    row.description = item.description
    row.priority = item.priority.value
    row.origin = item.origin.value
    row.source_refs = [ref.model_dump(mode="json") for ref in item.source_refs]
    row.related_ids = list(item.related_ids)
    row.tags = list(item.tags)
    row.notes = item.notes
    row.absence_note = item.absence_note
    row.details = item.details.model_dump(mode="json")


def _write_item(row: ItemRow, item: ScopeItem) -> None:
    _write_base(row, item)
    row.status = item.status.value
    row.version = item.version
    row.updated_by = item.updated_by.value
