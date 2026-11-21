"""Session CRUD. Config and platform are frozen once the scope is approved."""

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings
from app.core.errors import Conflict, NotFound
from app.db.models import Session as SessionRow
from app.domain.scope import (
    CloudPlatform,
    PlatformMode,
    ScopeStatus,
    SessionConfig,
    SessionCreate,
    SessionRead,
    SessionUpdate,
)
from app.estimation import with_commercial_defaults
from app.scope.service import scope_locked

LOCKED_HINT = (
    "The scope is approved, so changing {field} must be recorded with its impact. "
    "Send it to POST /api/v1/sessions/{session_id}/changes instead."
)


def to_read(row: SessionRow) -> SessionRead:
    return SessionRead(
        id=row.id,
        name=row.name,
        customer_name=row.customer_name,
        opportunity_context=row.opportunity_context,
        cloud_platform=CloudPlatform(row.cloud_platform) if row.cloud_platform else None,
        platform_mode=PlatformMode(row.platform_mode),
        config=SessionConfig.model_validate(row.config),
        scope_version=row.scope_version,
        scope_status=ScopeStatus(row.scope_status),
        ai_mode=row.ai_mode,
        scenario_slug=row.scenario_slug,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def create_session(
    db: DbSession, payload: SessionCreate, settings: Settings, scenario_slug: str = ""
) -> SessionRow:
    row = SessionRow(
        name=payload.name,
        customer_name=payload.customer_name,
        opportunity_context=payload.opportunity_context,
        cloud_platform=payload.cloud_platform.value if payload.cloud_platform else None,
        platform_mode=payload.platform_mode.value,
        config=with_commercial_defaults(payload.config).model_dump(mode="json"),
        ai_mode=settings.ai_mode.value,
        scenario_slug=scenario_slug,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_sessions(db: DbSession) -> list[SessionRow]:
    statement = select(SessionRow).order_by(SessionRow.created_at.desc(), SessionRow.id)
    return list(db.scalars(statement))


def get_session(db: DbSession, session_id: str) -> SessionRow:
    row = db.get(SessionRow, session_id)
    if row is None:
        raise NotFound(f"Session '{session_id}' was not found.")
    return row


def update_session(
    db: DbSession, row: SessionRow, payload: SessionUpdate, allow_locked: bool = False
) -> SessionRow:
    """`allow_locked=True` is for the change service, which records the impact itself."""
    changes = payload.model_dump(exclude_unset=True)
    locked = scope_locked(row) and not allow_locked
    if payload.name is not None:
        row.name = payload.name
    if payload.customer_name is not None:
        row.customer_name = payload.customer_name
    if payload.opportunity_context is not None:
        row.opportunity_context = payload.opportunity_context
    if "cloud_platform" in changes:
        platform = payload.cloud_platform.value if payload.cloud_platform else None
        if platform != row.cloud_platform:
            _ensure_unlocked(locked, row.id, "the cloud platform")
            row.cloud_platform = platform
    if payload.platform_mode is not None and payload.platform_mode.value != row.platform_mode:
        _ensure_unlocked(locked, row.id, "the platform mode")
        row.platform_mode = payload.platform_mode.value
    if payload.config is not None:
        incoming = payload.config
        # Overrides are priced in the old card's currency, so a new card starts clean.
        if incoming.rate_card_id != row.config.get("rate_card_id") and incoming.rate_overrides:
            incoming = incoming.model_copy(update={"rate_overrides": []})
        config = incoming.model_dump(mode="json")
        if config != row.config:
            _ensure_unlocked(locked, row.id, "the session config")
            row.config = config
    db.commit()
    db.refresh(row)
    return row


def delete_session(db: DbSession, row: SessionRow) -> None:
    """Documents, scope items, snapshots and artifacts go with it (ON DELETE CASCADE)."""
    db.delete(row)
    db.commit()


def _ensure_unlocked(locked: bool, session_id: str, field: str) -> None:
    if locked:
        raise Conflict(LOCKED_HINT.format(field=field, session_id=session_id))
