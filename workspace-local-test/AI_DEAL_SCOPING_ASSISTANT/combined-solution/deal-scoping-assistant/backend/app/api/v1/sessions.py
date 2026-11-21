"""Scoping session CRUD."""

from fastapi import APIRouter, status

from app.domain.scope import SessionCreate, SessionRead, SessionUpdate
from app.sessions.deps import AppSettings, Db, LoadedSession
from app.sessions.service import (
    create_session,
    delete_session,
    list_sessions,
    to_read,
    update_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create(payload: SessionCreate, db: Db, settings: AppSettings) -> SessionRead:
    return to_read(create_session(db, payload, settings))


@router.get("", response_model=list[SessionRead])
def index(db: Db) -> list[SessionRead]:
    return [to_read(row) for row in list_sessions(db)]


@router.get("/{session_id}", response_model=SessionRead)
def read(session: LoadedSession) -> SessionRead:
    return to_read(session)


@router.patch("/{session_id}", response_model=SessionRead)
def update(payload: SessionUpdate, session: LoadedSession, db: Db) -> SessionRead:
    return to_read(update_session(db, session, payload))


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(session: LoadedSession, db: Db) -> None:
    delete_session(db, session)
