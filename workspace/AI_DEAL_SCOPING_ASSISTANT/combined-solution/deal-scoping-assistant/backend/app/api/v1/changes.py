"""Change impact: record a change, list the records, regenerate what went stale."""

from fastapi import APIRouter, status

from app.api.v1.deps import ScenariosDir
from app.domain.changes import ChangeRecord, ChangeRequest
from app.sessions.deps import AppSettings, Db, LoadedSession
from app.workflow import changes as change_service
from app.workflow.changes import RegenerationResult

router = APIRouter(prefix="/sessions/{session_id}/changes", tags=["changes"])


@router.post("", response_model=ChangeRecord, status_code=status.HTTP_201_CREATED)
def record_change(payload: ChangeRequest, session: LoadedSession, db: Db) -> ChangeRecord:
    return change_service.apply_change(db, session, payload)


@router.get("", response_model=list[ChangeRecord])
def index(session: LoadedSession, db: Db) -> list[ChangeRecord]:
    return change_service.list_changes(db, session.id)


@router.post("/{change_id}/regenerate", response_model=RegenerationResult)
def regenerate(
    change_id: str,
    session: LoadedSession,
    db: Db,
    settings: AppSettings,
    scenarios: ScenariosDir,
) -> RegenerationResult:
    return change_service.regenerate(db, session, change_id, settings, scenarios)
