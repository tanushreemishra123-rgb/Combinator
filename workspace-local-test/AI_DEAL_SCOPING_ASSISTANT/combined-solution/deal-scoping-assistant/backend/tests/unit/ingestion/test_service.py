"""Validation rules around storing documents: type, size, limits, empty input."""

from io import BytesIO

import pytest
from docx import Document as DocxDocument
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings
from app.core.errors import Conflict, ValidationFailed
from app.db.models import Session as SessionRow
from app.domain.scope import DocumentFormat, ScopeStatus
from app.ingestion.service import (
    UploadTooLarge,
    add_pasted_document,
    add_uploaded_document,
    delete_document,
    list_documents,
)

SETTINGS = Settings(_env_file=None, max_upload_mb=1, max_input_chars=200)  # type: ignore[call-arg]


@pytest.fixture
def session(db: DbSession) -> SessionRow:
    row = SessionRow(name="Ingestion test")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _docx_bytes(text: str) -> bytes:
    document = DocxDocument()
    document.add_paragraph(text)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_upload_stores_only_extracted_text(db: DbSession, session: SessionRow) -> None:
    row = add_uploaded_document(
        db,
        session,
        filename="/etc/../requirements.txt",
        content_type="text/plain",
        data=b"We need a portal.",
        settings=SETTINGS,
    )
    assert row.name == "requirements.txt"  # any path is stripped
    assert row.format == DocumentFormat.TXT.value
    assert row.normalized_text == "We need a portal."
    assert row.segments[0]["segment_id"] == "D1.S1"


def test_docx_upload_with_generic_content_type(db: DbSession, session: SessionRow) -> None:
    row = add_uploaded_document(
        db,
        session,
        filename="brief.docx",
        content_type="application/octet-stream",
        data=_docx_bytes("Portal for brokers."),
        settings=SETTINGS,
    )
    assert row.format == DocumentFormat.DOCX.value
    assert "brokers" in row.normalized_text


def test_unsupported_extension_is_rejected(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(ValidationFailed, match="not supported"):
        add_uploaded_document(
            db,
            session,
            filename="notes.rtf",
            content_type="application/rtf",
            data=b"x",
            settings=SETTINGS,
        )


def test_mismatched_content_type_is_rejected(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(ValidationFailed, match="Content type"):
        add_uploaded_document(
            db,
            session,
            filename="notes.txt",
            content_type="image/png",
            data=b"x",
            settings=SETTINGS,
        )


def test_file_over_the_size_limit_is_rejected(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(UploadTooLarge) as error:
        add_uploaded_document(
            db,
            session,
            filename="big.txt",
            content_type="text/plain",
            data=b"x" * (2 * 1024 * 1024),
            settings=SETTINGS,
        )
    assert error.value.status_code == 413


def test_file_without_readable_text_is_rejected(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(ValidationFailed, match="no readable text"):
        add_uploaded_document(
            db,
            session,
            filename="blank.txt",
            content_type="text/plain",
            data=b"   \n\n  \t ",
            settings=SETTINGS,
        )


def test_session_input_limit_is_enforced(db: DbSession, session: SessionRow) -> None:
    add_pasted_document(db, session, name="one", text="a" * 150, settings=SETTINGS)
    with pytest.raises(ValidationFailed, match="limit is 200"):
        add_pasted_document(db, session, name="two", text="b" * 100, settings=SETTINGS)
    assert len(list_documents(db, session.id)) == 1


def test_segment_ids_continue_across_documents(db: DbSession, session: SessionRow) -> None:
    add_pasted_document(db, session, name="one", text="First document.", settings=SETTINGS)
    second = add_pasted_document(db, session, name="two", text="Second one.", settings=SETTINGS)
    assert second.segments[0]["segment_id"] == "D2.S1"


def test_delete_is_blocked_once_the_scope_exists(db: DbSession, session: SessionRow) -> None:
    row = add_pasted_document(db, session, name="one", text="Text.", settings=SETTINGS)
    session.scope_status = ScopeStatus.ANALYZED.value
    db.commit()
    with pytest.raises(Conflict, match="analyzed"):
        delete_document(db, session, row.public_id)
    session.scope_status = ScopeStatus.EMPTY.value
    db.commit()
    delete_document(db, session, row.public_id)
    assert list_documents(db, session.id) == []
