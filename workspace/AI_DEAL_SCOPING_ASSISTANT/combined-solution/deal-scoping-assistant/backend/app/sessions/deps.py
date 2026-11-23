"""Shared FastAPI dependencies for the session-scoped routers."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings, get_settings
from app.db.models import Session as SessionRow
from app.db.session import get_db
from app.sessions.service import get_session

Db = Annotated[DbSession, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def load_session(session_id: str, db: Db) -> SessionRow:
    """Load the session in the path or raise 404."""
    return get_session(db, session_id)


LoadedSession = Annotated[SessionRow, Depends(load_session)]
