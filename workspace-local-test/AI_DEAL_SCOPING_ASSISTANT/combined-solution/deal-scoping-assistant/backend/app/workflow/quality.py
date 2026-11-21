"""Runs the quality gate over the stored state and keeps the last report."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.artifacts import service as artifacts
from app.catalogs.cloud_services import load_cloud_catalog
from app.core.errors import NotFound
from app.db.models import QualityReport as ReportRow
from app.db.models import Session as SessionRow
from app.domain.quality import QualityReport, QualitySummary, ValidationItem
from app.estimation import config_hash
from app.quality.checks import QualityContext
from app.quality.service import build_context, run_quality_gate
from app.scope.service import list_rows, to_domain
from app.workflow import coverage as coverage_service
from app.workflow import estimate as estimate_service
from app.workflow.context import session_config


def build_quality_context(db: DbSession, session: SessionRow) -> QualityContext:
    """Assemble the read-only view the 16 checks work on."""
    items = [to_domain(row) for row in list_rows(db, session.id)]
    contents = artifacts.raw_contents(db, session.id)
    platform = artifacts.platform_of(session)
    catalog = (
        {platform.value: frozenset(load_cloud_catalog(platform).service_names())}
        if platform
        else None
    )
    estimation_config = estimate_service.estimation_config(session)
    return build_context(
        session_id=session.id,
        scope_version=session.scope_version,
        items=items,
        contents=contents,
        config=session_config(session),
        statuses=artifacts.statuses(db, session.id),
        estimate=artifacts.load_estimate(db, session.id),
        cloud_platform=platform,
        catalog_services=catalog,
        rate_card=estimation_config.rate_card,
        expected_config_hash=config_hash(estimation_config),
        coverage=coverage_service.build(db, session.id),
    )


def _store(db: DbSession, session: SessionRow, report: QualityReport) -> None:
    """One report per session: the gate is a pre-export check, not a history."""
    for row in db.scalars(select(ReportRow).where(ReportRow.session_id == session.id)):
        db.delete(row)
    db.add(
        ReportRow(
            session_id=session.id,
            scope_version=report.scope_version,
            fingerprint=artifacts.state_fingerprint(db, session),
            checks=[check.model_dump(mode="json") for check in report.checks],
            summary=report.summary.model_dump(mode="json"),
            validation_items=[
                item.model_dump(mode="json") for item in report.items_requiring_human_validation
            ],
        )
    )
    db.commit()


def _to_report(row: ReportRow) -> QualityReport:
    return QualityReport(
        session_id=row.session_id,
        scope_version=row.scope_version,
        checks=row.checks,
        summary=QualitySummary.model_validate(row.summary),
        items_requiring_human_validation=[
            ValidationItem.model_validate(item) for item in row.validation_items
        ],
        created_at=row.created_at,
    )


def run(db: DbSession, session: SessionRow) -> QualityReport:
    report = run_quality_gate(build_quality_context(db, session), datetime.now(UTC))
    _store(db, session, report)
    return report


def latest(db: DbSession, session: SessionRow) -> QualityReport | None:
    """The stored report, or None when the scope or any artifact changed since it ran."""
    statement = (
        select(ReportRow)
        .where(ReportRow.session_id == session.id)
        .order_by(ReportRow.created_at.desc())
    )
    row = db.scalars(statement).first()
    if row is None or row.fingerprint != artifacts.state_fingerprint(db, session):
        return None
    return _to_report(row)


def get(db: DbSession, session: SessionRow) -> QualityReport:
    report = latest(db, session)
    if report is None:
        raise NotFound(
            "The quality gate has not been run for the current state of this session. Run it."
        )
    return report
