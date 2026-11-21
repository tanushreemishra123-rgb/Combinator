"""Quality gate and the requirement coverage view."""

from fastapi import APIRouter

from app.domain.quality import QualityReport
from app.sessions.deps import Db, LoadedSession
from app.traceability.coverage import CoverageReport
from app.workflow import coverage as coverage_service
from app.workflow import quality as quality_service

router = APIRouter(prefix="/sessions/{session_id}", tags=["quality"])


@router.post("/quality-gate/run", response_model=QualityReport)
def run_gate(session: LoadedSession, db: Db) -> QualityReport:
    return quality_service.run(db, session)


@router.get("/quality-gate", response_model=QualityReport)
def read_gate(session: LoadedSession, db: Db) -> QualityReport:
    return quality_service.get(db, session)


@router.get("/coverage", response_model=CoverageReport)
def coverage(session: LoadedSession, db: Db) -> CoverageReport:
    return coverage_service.build(db, session.id)
