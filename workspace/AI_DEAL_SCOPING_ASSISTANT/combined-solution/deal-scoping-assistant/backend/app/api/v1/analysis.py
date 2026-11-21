"""Runs the requirement analysis for a session."""

from fastapi import APIRouter

from app.api.v1.deps import ScenariosDir
from app.sessions.deps import AppSettings, Db, LoadedSession
from app.workflow.analysis import AnalysisResult, run_analysis

router = APIRouter(prefix="/sessions/{session_id}", tags=["analysis"])


@router.post("/analysis", response_model=AnalysisResult)
def analyze(
    session: LoadedSession, db: Db, settings: AppSettings, scenarios: ScenariosDir
) -> AnalysisResult:
    return run_analysis(db, session, settings, scenarios)
