"""The scoping package: diagrams, build, read and export as a file."""

from fastapi import APIRouter
from fastapi.responses import Response

from app.domain.package import DocumentModel
from app.sessions.deps import Db, LoadedSession
from app.workflow import package as package_service
from app.workflow.package import Diagrams, ExportRequest

router = APIRouter(prefix="/sessions/{session_id}", tags=["package"])


@router.get("/diagrams", response_model=Diagrams)
def diagrams(session: LoadedSession, db: Db) -> Diagrams:
    """Mermaid sources; the browser renders them and sends the PNGs back for export."""
    return package_service.diagrams(db, session.id)


@router.post("/package/build", response_model=DocumentModel)
def build(session: LoadedSession, db: Db) -> DocumentModel:
    return package_service.build(db, session)


@router.get("/package", response_model=DocumentModel)
def read(session: LoadedSession, db: Db) -> DocumentModel:
    return package_service.get(db, session)


@router.post(
    "/package/export",
    response_class=Response,
    responses={200: {"content": {"application/octet-stream": {}}, "description": "The export."}},
)
def export(payload: ExportRequest, session: LoadedSession, db: Db) -> Response:
    rendered = package_service.export(db, session, payload)
    return Response(
        content=rendered.content,
        media_type=rendered.media_type,
        headers={"Content-Disposition": f'attachment; filename="{rendered.filename}"'},
    )
