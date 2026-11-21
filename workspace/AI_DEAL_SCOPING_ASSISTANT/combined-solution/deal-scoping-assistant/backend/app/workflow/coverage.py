"""The requirement coverage view, computed from the current scope and artifacts."""

from sqlalchemy.orm import Session as DbSession

from app.artifacts import service as artifacts
from app.scope.service import list_rows, to_domain
from app.traceability.coverage import CoverageReport, build_coverage


def build(db: DbSession, session_id: str) -> CoverageReport:
    items = [to_domain(row) for row in list_rows(db, session_id)]
    return build_coverage(items, artifacts.raw_contents(db, session_id))
