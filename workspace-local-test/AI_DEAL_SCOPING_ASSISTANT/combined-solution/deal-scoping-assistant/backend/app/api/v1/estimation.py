"""Estimation configuration, rate cards, the estimate and the historical reference panel."""

from fastapi import APIRouter

from app.domain.estimation import Estimate, EstimationConfig, HistoricalProjects, RateCard
from app.domain.scope import SessionConfig, SessionUpdate
from app.estimation import load_historical_projects
from app.sessions.deps import Db, LoadedSession
from app.sessions.service import update_session
from app.workflow import estimate as estimate_service

router = APIRouter(prefix="/sessions/{session_id}", tags=["estimation"])
reference_router = APIRouter(tags=["estimation"])


@router.get("/estimation-config", response_model=EstimationConfig)
def read_config(session: LoadedSession) -> EstimationConfig:
    return estimate_service.estimation_config(session)


@router.put("/estimation-config", response_model=EstimationConfig)
def write_config(payload: SessionConfig, session: LoadedSession, db: Db) -> EstimationConfig:
    """Before approval the inputs are edited here; afterwards they go through /changes."""
    update_session(db, session, SessionUpdate(config=payload))
    return estimate_service.estimation_config(session)


@router.post("/estimate/calculate", response_model=Estimate)
def calculate(session: LoadedSession, db: Db) -> Estimate:
    return estimate_service.calculate(db, session)


@router.get("/estimate", response_model=Estimate)
def read_estimate(session: LoadedSession, db: Db) -> Estimate:
    return estimate_service.get(db, session.id)


@reference_router.get("/rate-cards", response_model=list[RateCard])
def rate_cards() -> list[RateCard]:
    return estimate_service.rate_cards()


@reference_router.get("/estimate/historical-projects", response_model=HistoricalProjects)
def historical_projects() -> HistoricalProjects:
    """Reference only; these numbers never enter the calculation."""
    return load_historical_projects()
