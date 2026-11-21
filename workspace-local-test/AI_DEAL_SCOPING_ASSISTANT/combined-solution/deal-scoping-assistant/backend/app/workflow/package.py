"""Builds the scoping package from the current state and exports it as a file."""

import base64
import binascii
from enum import StrEnum

from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.artifacts import service as artifacts
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.db.models import Package as PackageRow
from app.db.models import Session as SessionRow
from app.domain.artifacts import Architecture, ArtifactKind, IntegrationArchitecture
from app.domain.base import DomainModel
from app.domain.package import DocumentModel
from app.domain.quality import ExportStatus
from app.package import (
    ARCHITECTURE_DIAGRAM_ID,
    INTEGRATION_DIAGRAM_ID,
    PackageArtifacts,
    PackageMeta,
    RenderedDocument,
    architecture_mermaid,
    build_package,
    integration_mermaid,
    render_docx,
    render_markdown,
    render_pdf,
)
from app.package.errors import InvalidDiagramImage
from app.package.renderers.base import MAX_IMAGE_BYTES, validate_png
from app.scope.service import list_rows, to_domain
from app.sessions.service import to_read
from app.workflow import coverage as coverage_service
from app.workflow import quality as quality_service

PNG_DATA_URL_PREFIX = "data:image/png;base64,"


class ExportFormat(StrEnum):
    MD = "md"
    DOCX = "docx"
    PDF = "pdf"


class Diagrams(DomainModel):
    """Mermaid sources the browser renders; the PNGs come back for DOCX and PDF."""

    architecture_mermaid: str = Field(description="Mermaid source of the architecture diagram.")
    integration_mermaid: str = Field(description="Mermaid source of the integration diagram.")


class ExportRequest(DomainModel):
    format: ExportFormat = Field(description="md, docx or pdf.")
    architecture_diagram_png: str = Field(
        default="", description="data:image/png;base64,... of the rendered architecture diagram."
    )
    integration_diagram_png: str = Field(
        default="", description="data:image/png;base64,... of the rendered integration diagram."
    )


def _decode_png(value: str, label: str) -> bytes:
    """Strictly decode one data URL; anything else is a bad request, not a broken export."""
    if not value.startswith(PNG_DATA_URL_PREFIX):
        raise ValidationFailed(f"The {label} must be a '{PNG_DATA_URL_PREFIX}...' data URL.")
    payload = value[len(PNG_DATA_URL_PREFIX) :]
    # Base64 grows the data by a third; reject oversized input before decoding it.
    if len(payload) > MAX_IMAGE_BYTES // 3 * 4 + 4:
        raise ValidationFailed(f"The {label} is larger than the {MAX_IMAGE_BYTES} byte limit.")
    try:
        data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValidationFailed(f"The {label} is not valid base64.") from exc
    try:
        return validate_png(data)
    except InvalidDiagramImage as exc:
        raise ValidationFailed(f"The {label} is not a usable PNG: {exc}") from exc


def diagrams(db: DbSession, session_id: str) -> Diagrams:
    """Empty strings until the artifact behind a diagram has been generated."""
    contents = artifacts.load_contents(db, session_id)
    architecture = contents.get(ArtifactKind.ARCHITECTURE)
    integration = contents.get(ArtifactKind.INTEGRATION_ARCHITECTURE)
    # Flow endpoints are often scope item ids; the titles turn them into readable node labels.
    titles = {row.id: row.title for row in list_rows(db, session_id)}
    return Diagrams(
        architecture_mermaid=(
            architecture_mermaid(architecture, titles)
            if isinstance(architecture, Architecture)
            else ""
        ),
        integration_mermaid=(
            integration_mermaid(integration)
            if isinstance(integration, IntegrationArchitecture)
            else ""
        ),
    )


def build(db: DbSession, session: SessionRow) -> DocumentModel:
    """Assemble the package from the current state; the gate runs first when it is not current."""
    report = quality_service.latest(db, session) or quality_service.run(db, session)
    document = build_package(
        session=to_read(session),
        scope_items=[to_domain(row) for row in list_rows(db, session.id)],
        artifacts=PackageArtifacts.from_envelopes(artifacts.list_artifacts(db, session.id)),
        estimate=artifacts.load_estimate(db, session.id),
        coverage=coverage_service.build(db, session.id),
        quality_report=report,
    )
    _store(db, session, document)
    return document


def _store(db: DbSession, session: SessionRow, document: DocumentModel) -> None:
    row = db.scalars(select(PackageRow).where(PackageRow.session_id == session.id)).first()
    if row is None:
        row = PackageRow(session_id=session.id)
        db.add(row)
    row.scope_version = session.scope_version
    row.fingerprint = artifacts.state_fingerprint(db, session)
    row.document = document.model_dump(mode="json")
    db.commit()


def get(db: DbSession, session: SessionRow) -> DocumentModel:
    """The stored package, only while it still matches the scope and every artifact."""
    row = db.scalars(select(PackageRow).where(PackageRow.session_id == session.id)).first()
    if row is None:
        raise NotFound("This session has no package yet. Build it first.")
    if row.fingerprint != artifacts.state_fingerprint(db, session):
        raise NotFound(
            "The package is out of date: something changed since it was built. Build it again."
        )
    return DocumentModel.model_validate(row.document)


def export(db: DbSession, session: SessionRow, request: ExportRequest) -> RenderedDocument:
    """Render a current package: rebuilt when missing or out of date, refused when blocked."""
    try:
        document = get(db, session)
    except NotFound:
        document = build(db, session)
    report = quality_service.latest(db, session)
    if report is not None and report.summary.export_status is ExportStatus.BLOCKED:
        raise Conflict(
            "Export is blocked: a required deliverable is missing. "
            "Generate it and run the quality gate again."
        )
    images: dict[str, bytes] = {}
    if request.architecture_diagram_png:
        images[ARCHITECTURE_DIAGRAM_ID] = _decode_png(
            request.architecture_diagram_png, "architecture diagram image"
        )
    if request.integration_diagram_png:
        images[INTEGRATION_DIAGRAM_ID] = _decode_png(
            request.integration_diagram_png, "integration diagram image"
        )
    meta = PackageMeta.from_session(to_read(session))
    if request.format is ExportFormat.MD:
        return render_markdown(document, meta)
    if request.format is ExportFormat.DOCX:
        return render_docx(document, meta, images)
    return render_pdf(document, meta, images)
