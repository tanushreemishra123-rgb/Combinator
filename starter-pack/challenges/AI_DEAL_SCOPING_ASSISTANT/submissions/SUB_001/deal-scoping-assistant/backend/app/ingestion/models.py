"""Request and list models for documents (the full read model lives in `app.domain.scope`)."""

from datetime import datetime

from pydantic import Field

from app.domain.base import DomainModel
from app.domain.scope import DocumentFormat, DocumentKind


class PastedDocument(DomainModel):
    """JSON body of `POST /sessions/{id}/documents` when the user pastes text."""

    name: str = Field(min_length=1, max_length=255, description="Label for the pasted text.")
    text: str = Field(min_length=1, description="The pasted customer text.")


class DocumentSummary(DomainModel):
    """List view: no text, so the list stays small; fetch one document for its segments."""

    id: str = Field(description="Document id.")
    session_id: str = Field(description="Owning session id.")
    name: str = Field(description="File name or label.")
    kind: DocumentKind = Field(description="pasted or uploaded.")
    format: DocumentFormat = Field(description="Source format of the document.")
    char_count: int = Field(description="Length of the normalized text.")
    segment_count: int = Field(description="Number of addressable segments.")
    created_at: datetime = Field(description="Creation timestamp.")
