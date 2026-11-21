"""The post-approval path: apply a change, record its impact, regenerate what it broke."""

from datetime import UTC, datetime
from pathlib import Path

from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.artifacts import service as artifacts
from app.change_impact.models import SessionState
from app.change_impact.rules import UnknownChange
from app.change_impact.service import analyze_change, regeneration_order
from app.core.config import Settings
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.db.models import ChangeRecord as ChangeRow
from app.db.models import ScopeSnapshot as SnapshotRow
from app.db.models import Session as SessionRow
from app.db.models.session import new_uuid
from app.domain.artifacts import ArtifactEnvelope, ArtifactKind, ArtifactStatus
from app.domain.base import DomainModel
from app.domain.changes import ChangeRecord, ChangeRequest, ImpactAction
from app.domain.estimation import Estimate
from app.domain.scope import ScopeStatus
from app.scope import service as scope_service
from app.workflow import estimate as estimate_service
from app.workflow import generation
from app.workflow.context import session_config
from app.workflow.mutations import apply_mutation


class RegenerationResult(DomainModel):
    """What `POST /changes/{id}/regenerate` produced."""

    change_id: str = Field(description="Change the regeneration answers.")
    regenerated: list[ArtifactEnvelope] = Field(
        default_factory=list, description="Artifacts produced again, in dependency order."
    )
    untouched: list[ArtifactKind] = Field(
        default_factory=list, description="Artifacts that were fresh and were left alone."
    )
    estimate: Estimate | None = Field(default=None, description="The recalculated estimate.")
    mock_notice: str = Field(default="", description="Set when recorded answers are replayed.")


def _state(db: DbSession, session: SessionRow) -> SessionState:
    return SessionState(
        session_id=session.id,
        scope_version=session.scope_version,
        cloud_platform=artifacts.platform_of(session),
        config=session_config(session),
        items=[scope_service.to_domain(row) for row in scope_service.list_rows(db, session.id)],
        artifacts=artifacts.raw_contents(db, session.id),
    )


def _store_record(db: DbSession, record: ChangeRecord) -> None:
    db.add(
        ChangeRow(
            id=record.id,
            session_id=record.session_id,
            scope_version=record.scope_version,
            request=record.request.model_dump(mode="json"),
            affected=[entry.model_dump(mode="json") for entry in record.affected],
            affected_item_ids=list(record.affected_item_ids),
            stale_kinds=[kind.value for kind in record.stale_kinds],
            coverage_affected=record.coverage_affected,
            quality_gate_affected=record.quality_gate_affected,
            unaffected_summary=list(record.unaffected_summary),
            suggested_actions=list(record.suggested_actions),
            narrative=record.narrative,
        )
    )
    db.commit()


def _to_record(row: ChangeRow) -> ChangeRecord:
    return ChangeRecord(
        id=row.id,
        session_id=row.session_id,
        scope_version=row.scope_version,
        request=ChangeRequest.model_validate(row.request),
        affected=row.affected,
        affected_item_ids=list(row.affected_item_ids),
        stale_kinds=[ArtifactKind(kind) for kind in row.stale_kinds],
        coverage_affected=row.coverage_affected,
        quality_gate_affected=row.quality_gate_affected,
        unaffected_summary=list(row.unaffected_summary),
        suggested_actions=list(row.suggested_actions),
        narrative=row.narrative,
        created_at=row.created_at,
    )


def apply_change(db: DbSession, session: SessionRow, request: ChangeRequest) -> ChangeRecord:
    """Apply one change, bump the scope version, store the impact and mark what went stale."""
    if session.scope_status != ScopeStatus.APPROVED.value:
        raise Conflict(
            "Change tracking starts after the first approval. Until then, edit the scope "
            f"directly under /api/v1/sessions/{session.id}/scope."
        )
    before = _state(db, session)
    item_ids, values = apply_mutation(db, session, request)
    applied = request.model_copy(
        update={"item_ids": request.item_ids or item_ids, "values": values}
    )

    db.refresh(session)
    session.scope_version += 1
    db.add(
        SnapshotRow(
            session_id=session.id,
            scope_version=session.scope_version,
            items=[item.model_dump(mode="json") for item in _state(db, session).items],
            reason=applied.description or applied.change_type.value,
        )
    )
    db.commit()
    db.refresh(session)

    after = _state(db, session)
    try:
        record = analyze_change(applied, before, after, new_uuid(), datetime.now(UTC))
    except UnknownChange as exc:
        raise ValidationFailed(str(exc)) from exc
    _store_record(db, record)

    reason = applied.description or (
        f"{applied.change_type.value} at scope version {after.scope_version}"
    )
    artifacts.mark_stale(db, session.id, record.stale_kinds, reason)
    if _recalculation_only(record) and artifacts.has(db, session.id, ArtifactKind.ESTIMATE):
        # Nothing the model wrote is affected, so the numbers are simply redone now.
        estimate_service.calculate(db, session)
    return record


def _recalculation_only(record: ChangeRecord) -> bool:
    return all(entry.action is not ImpactAction.REGENERATE for entry in record.affected)


def list_changes(db: DbSession, session_id: str) -> list[ChangeRecord]:
    statement = (
        select(ChangeRow)
        .where(ChangeRow.session_id == session_id)
        .order_by(ChangeRow.created_at, ChangeRow.id)
    )
    return [_to_record(row) for row in db.scalars(statement)]


def get_change(db: DbSession, session_id: str, change_id: str) -> ChangeRecord:
    row = db.get(ChangeRow, change_id)
    if row is None or row.session_id != session_id:
        raise NotFound(f"Change '{change_id}' was not found in this session.")
    return _to_record(row)


def regenerate(
    db: DbSession,
    session: SessionRow,
    change_id: str,
    settings: Settings,
    scenarios_dir: Path,
) -> RegenerationResult:
    """Produce the stale artifacts again, in dependency order; fresh ones are not touched."""
    record = get_change(db, session.id, change_id)
    statuses = artifacts.statuses(db, session.id)
    stale = [kind for kind, status in statuses.items() if status is ArtifactStatus.STALE]
    order = regeneration_order(stale)
    description = record.request.description or record.request.change_type.value

    produced: list[ArtifactEnvelope] = []
    notice = ""
    for kind in order:
        if kind is ArtifactKind.ESTIMATE:
            continue  # the estimate is recalculated below, never written by a model
        result = generation.generate(
            db,
            session,
            kind,
            generation.GenerateOptions(),
            settings,
            scenarios_dir,
            change_description=description,
        )
        produced.append(result.artifact)
        notice = result.mock_notice
        db.refresh(session)

    estimate = None
    if artifacts.has(db, session.id, ArtifactKind.ESTIMATE_DRIVERS):
        estimate = estimate_service.calculate(db, session)
    untouched = [kind for kind in statuses if kind not in order]
    return RegenerationResult(
        change_id=change_id,
        regenerated=produced,
        untouched=untouched,
        estimate=estimate,
        mock_notice=notice,
    )
