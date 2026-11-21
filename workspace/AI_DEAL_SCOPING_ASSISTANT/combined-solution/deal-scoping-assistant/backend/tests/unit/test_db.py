from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session as OrmSession

from app.db import models


def make_full_session(db: OrmSession, name: str) -> models.Session:
    session = models.Session(name=name, customer_name="Acme")
    session.documents.append(
        models.SourceDocument(name="rfp.md", kind="pasted", format="md", normalized_text="text")
    )
    session.scope_items.append(
        models.ScopeItem(id="FR_01", type="FR", title="Login", origin="customer_stated")
    )
    session.snapshots.append(models.ScopeSnapshot(scope_version=1, items=[]))
    session.artifacts.append(models.Artifact(kind="prd", version=1))
    session.changes.append(models.ChangeRecord(scope_version=2))
    session.quality_reports.append(models.QualityReport(scope_version=2))
    db.add(session)
    db.commit()
    return session


def count_children(db: OrmSession, session_id: str) -> int:
    total = 0
    for model in (
        models.SourceDocument,
        models.ScopeItem,
        models.ScopeSnapshot,
        models.Artifact,
        models.ChangeRecord,
        models.QualityReport,
    ):
        total += db.scalar(
            select(func.count()).select_from(model).where(model.session_id == session_id)
        )
    return total


def test_create_and_read_back(db: OrmSession) -> None:
    session = make_full_session(db, "create")
    stored = db.get(models.Session, session.id)
    assert stored is not None
    assert stored.scope_items[0].id == "FR_01"
    assert stored.documents[0].normalized_text == "text"
    assert count_children(db, session.id) == 6


def test_timestamps_come_back_timezone_aware(db: OrmSession) -> None:
    # SQLite stores naive datetimes; the column type must hand back UTC-aware values so
    # the API never emits a timestamp a browser would misread as local time.
    session = make_full_session(db, "tz")
    db.expire_all()
    stored = db.get(models.Session, session.id)
    assert stored is not None
    assert stored.created_at.tzinfo is not None
    assert (
        stored.created_at.utcoffset() is not None
        and stored.created_at.utcoffset().total_seconds() == 0
    )


def test_orm_delete_cascades(db: OrmSession) -> None:
    session = make_full_session(db, "orm-cascade")
    db.delete(session)
    db.commit()
    assert count_children(db, session.id) == 0


def test_database_level_cascade(db: OrmSession) -> None:
    # Bypasses the ORM cascade so the ON DELETE CASCADE / sqlite pragma is exercised.
    session = make_full_session(db, "db-cascade")
    db.execute(delete(models.Session).where(models.Session.id == session.id))
    db.commit()
    assert count_children(db, session.id) == 0


def test_scope_item_ids_are_unique_per_session(db: OrmSession) -> None:
    first = make_full_session(db, "ids-a")
    second = make_full_session(db, "ids-b")
    assert first.scope_items[0].id == second.scope_items[0].id == "FR_01"
