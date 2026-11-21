"""Source documents: upload a file or paste text, list, read, delete."""

import json

from fastapi import APIRouter, Request, status
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from app.core.errors import ValidationFailed
from app.domain.scope import SourceDocument
from app.ingestion.models import DocumentSummary, PastedDocument
from app.ingestion.service import (
    add_pasted_document,
    add_uploaded_document,
    delete_document,
    get_document,
    list_documents,
    to_domain,
    to_summary,
)
from app.sessions.deps import AppSettings, Db, LoadedSession

router = APIRouter(prefix="/sessions/{session_id}/documents", tags=["documents"])

# One endpoint takes either a multipart file or pasted JSON, which FastAPI cannot
# describe on its own, so the request body is documented here for the generated client.
_BODY_SCHEMA = {
    "requestBody": {
        "required": True,
        "content": {
            "multipart/form-data": {
                "schema": {
                    "type": "object",
                    "properties": {"file": {"type": "string", "format": "binary"}},
                    "required": ["file"],
                }
            },
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}, "text": {"type": "string"}},
                    "required": ["name", "text"],
                }
            },
        },
    }
}


@router.post(
    "",
    response_model=SourceDocument,
    status_code=status.HTTP_201_CREATED,
    openapi_extra=_BODY_SCHEMA,
)
async def add_document(
    request: Request, session: LoadedSession, db: Db, settings: AppSettings
) -> SourceDocument:
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        upload = (await request.form()).get("file")
        if not isinstance(upload, UploadFile) or not upload.filename:
            raise ValidationFailed("Send the file in a form field named 'file'.")
        row = add_uploaded_document(
            db,
            session,
            filename=upload.filename,
            content_type=upload.content_type or "",
            data=await upload.read(),
            settings=settings,
        )
    else:
        pasted = _parse_pasted(await request.body())
        row = add_pasted_document(
            db, session, name=pasted.name, text=pasted.text, settings=settings
        )
    return to_domain(row)


@router.get("", response_model=list[DocumentSummary])
def index(session: LoadedSession, db: Db) -> list[DocumentSummary]:
    return [to_summary(row) for row in list_documents(db, session.id)]


@router.get("/{document_id}", response_model=SourceDocument)
def read(document_id: str, session: LoadedSession, db: Db) -> SourceDocument:
    return to_domain(get_document(db, session.id, document_id))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(document_id: str, session: LoadedSession, db: Db) -> None:
    delete_document(db, session, document_id)


def _parse_pasted(body: bytes) -> PastedDocument:
    try:
        return PastedDocument.model_validate(json.loads(body))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        message = "Send a multipart file or a JSON body with 'name' and 'text'."
        raise ValidationFailed(message) from exc
    except ValidationError as exc:
        messages = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
        raise ValidationFailed("The pasted document is invalid.", messages) from exc
