"""Seeded scenarios and the shortcut that starts a session from one."""

from fastapi import APIRouter, status

from app.api.v1.deps import ScenariosDir
from app.domain.scope import SessionRead
from app.sessions.deps import AppSettings, Db
from app.sessions.scenarios import (
    Scenario,
    create_session_from_scenario,
    list_scenarios,
)
from app.sessions.service import to_read

router = APIRouter(tags=["scenarios"])


@router.get("/scenarios", response_model=list[Scenario])
def index(root: ScenariosDir) -> list[Scenario]:
    return list_scenarios(root)


@router.post(
    "/sessions/from-scenario/{slug}",
    response_model=SessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_from_scenario(
    slug: str, root: ScenariosDir, db: Db, settings: AppSettings
) -> SessionRead:
    return to_read(create_session_from_scenario(db, root, slug, settings))
