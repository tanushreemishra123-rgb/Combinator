"""Validate, extract and store customer documents. Uploaded binaries are never kept."""

from pathlib import PurePath

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings
from app.core.errors import AppError, Conflict, NotFound, ValidationFailed
from app.db.models import Session as SessionRow
from app.db.models import SourceDocument as DocumentRow
from app.domain.scope import (
    DocumentFormat,
    DocumentKind,
    ScopeStatus,
    Segment,
    SourceDocument,
)
from app.ingestion.extractors import RawBlock, extract
from app.ingestion.models import DocumentSummary
from app.ingestion.normalizer import normalize

_BYTES_PER_MB = 1024 * 1024

_FORMATS_BY_SUFFIX = {
    ".txt": DocumentFormat.TXT,
    ".md": DocumentFormat.MD,
    ".pdf": DocumentFormat.PDF,
    ".docx": DocumentFormat.DOCX,
}

# Browsers are inconsistent about these, so a generic or missing type is accepted.
_CONTENT_TYPES = {
    DocumentFormat.TXT: {"text/plain"},
    DocumentFormat.MD: {"text/markdown", "text/x-markdown", "text/plain"},
    DocumentFormat.PDF: {"application/pdf"},
    DocumentFormat.DOCX: {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
}
_GENERIC_CONTENT_TYPES = {"", "application/octet-stream", "binary/octet-stream"}


class UploadTooLarge(AppError):
    """413: the file is bigger than MAX_UPLOAD_MB."""

    status_code = 413
    problem_type = "https://tc-101.local/problems/upload-too-large"
    title = "Upload Too Large"


def to_domain(row: DocumentRow) -> SourceDocument:
    return SourceDocument(
        id=row.public_id,
        session_id=row.session_id,
        name=row.name,
        kind=DocumentKind(row.kind),
        format=DocumentFormat(row.format),
        normalized_text=row.normalized_text,
        segments=[Segment.model_validate(segment) for segment in row.segments],
        created_at=row.created_at,
    )


def to_summary(row: DocumentRow) -> DocumentSummary:
    return DocumentSummary(
        id=row.public_id,
        session_id=row.session_id,
        name=row.name,
        kind=DocumentKind(row.kind),
        format=DocumentFormat(row.format),
        char_count=len(row.normalized_text),
        segment_count=len(row.segments),
        created_at=row.created_at,
    )


def list_documents(db: DbSession, session_id: str) -> list[DocumentRow]:
    statement = (
        select(DocumentRow)
        .where(DocumentRow.session_id == session_id)
        .order_by(DocumentRow.created_at, DocumentRow.id)
    )
    return list(db.scalars(statement))


def get_document(db: DbSession, session_id: str, document_id: str) -> DocumentRow:
    """Documents are addressed by their per-session public id (D1, D2, ...)."""
    statement = select(DocumentRow).where(
        DocumentRow.session_id == session_id, DocumentRow.public_id == document_id
    )
    row = db.scalars(statement).first()
    if row is None:
        raise NotFound(f"Document '{document_id}' was not found in this session.")
    return row


def delete_document(db: DbSession, session: SessionRow, document_id: str) -> None:
    """Deleting a source would orphan the scope items traced to it, so only before analysis."""
    if session.scope_status != ScopeStatus.EMPTY.value:
        raise Conflict(
            "Documents cannot be deleted once the scope has been analyzed, "
            "because scope items reference their text."
        )
    db.delete(get_document(db, session.id, document_id))
    db.commit()


def resolve_format(filename: str) -> DocumentFormat:
    suffix = PurePath(filename).suffix.lower()
    document_format = _FORMATS_BY_SUFFIX.get(suffix)
    if document_format is None:
        supported = ", ".join(sorted(_FORMATS_BY_SUFFIX))
        raise ValidationFailed(f"'{suffix or filename}' is not supported. Use {supported}.")
    return document_format


def _check_content_type(document_format: DocumentFormat, content_type: str) -> None:
    media_type = content_type.split(";")[0].strip().lower()
    if media_type in _GENERIC_CONTENT_TYPES:
        return
    if media_type not in _CONTENT_TYPES[document_format]:
        raise ValidationFailed(
            f"Content type '{media_type}' does not match a {document_format.value} file."
        )


def add_uploaded_document(
    db: DbSession,
    session: SessionRow,
    *,
    filename: str,
    content_type: str,
    data: bytes,
    settings: Settings,
) -> DocumentRow:
    name = PurePath(filename).name  # never trust a client-supplied path
    if not name:
        raise ValidationFailed("The upload has no file name.")
    document_format = resolve_format(name)
    _check_content_type(document_format, content_type)
    limit = settings.max_upload_mb * _BYTES_PER_MB
    if len(data) > limit:
        raise UploadTooLarge(f"The file is larger than the {settings.max_upload_mb} MB limit.")
    blocks = extract(document_format, data)
    return _store(
        db,
        session,
        name=name[:255],
        kind=DocumentKind.UPLOADED,
        document_format=document_format,
        blocks=blocks,
        settings=settings,
    )


def add_pasted_document(
    db: DbSession, session: SessionRow, *, name: str, text: str, settings: Settings
) -> DocumentRow:
    """Pasted text is read as markdown so '#' headings become heading segments."""
    blocks = extract(DocumentFormat.MD, text.encode("utf-8"))
    return _store(
        db,
        session,
        name=name[:255],
        kind=DocumentKind.PASTED,
        document_format=DocumentFormat.MD,
        blocks=blocks,
        settings=settings,
    )


def _store(
    db: DbSession,
    session: SessionRow,
    *,
    name: str,
    kind: DocumentKind,
    document_format: DocumentFormat,
    blocks: list[RawBlock],
    settings: Settings,
) -> DocumentRow:
    index = _next_index(db, session.id)
    document = normalize(blocks, index)
    if not document.normalized_text:
        raise ValidationFailed(f"'{name}' contains no readable text.")
    _check_session_budget(db, session, len(document.normalized_text), settings)
    row = DocumentRow(
        session_id=session.id,
        public_id=f"D{index}",
        name=name,
        kind=kind.value,
        format=document_format.value,
        normalized_text=document.normalized_text,
        segments=[segment.model_dump(mode="json") for segment in document.segments],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _next_index(db: DbSession, session_id: str) -> int:
    """One past the highest number in use, so a deletion never reuses D1."""
    used = [row.public_id for row in list_documents(db, session_id)]
    numbers = [int(value[1:]) for value in used if value.startswith("D") and value[1:].isdigit()]
    return max(numbers, default=0) + 1


def _check_session_budget(
    db: DbSession, session: SessionRow, new_chars: int, settings: Settings
) -> None:
    used = sum(len(row.normalized_text) for row in list_documents(db, session.id))
    if used + new_chars > settings.max_input_chars:
        raise ValidationFailed(
            f"This session already holds {used} characters and the document adds {new_chars}; "
            f"the limit is {settings.max_input_chars}. Remove a document or shorten the text."
        )
