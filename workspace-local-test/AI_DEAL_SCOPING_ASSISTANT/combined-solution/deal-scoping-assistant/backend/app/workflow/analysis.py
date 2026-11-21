"""Runs the analysis stages and stores the result as the reviewable scope."""

from dataclasses import replace
from pathlib import Path

from pydantic import Field
from sqlalchemy.orm import Session as DbSession

from app.ai.findings import Finding
from app.core.config import Settings
from app.core.errors import Conflict, ValidationFailed
from app.db.models import Session as SessionRow
from app.domain.base import DomainModel
from app.generation.requirements import analyze_requirements
from app.ingestion.service import list_documents
from app.ingestion.service import to_domain as document_to_domain
from app.scope.models import AnalyzedItem, ScopeView
from app.scope.service import build_view, replace_analysis, scope_locked
from app.workflow.context import build_context


class AnalysisResult(DomainModel):
    """What `POST /sessions/{id}/analysis` returns."""

    scope: ScopeView = Field(description="The scope as it now stands, grouped by type.")
    findings: list[Finding] = Field(
        default_factory=list, description="Validator findings from the analysis stages."
    )
    mock_notice: str = Field(default="", description="Set when recorded answers are replayed.")


def run_analysis(
    db: DbSession, session: SessionRow, settings: Settings, scenarios_dir: Path
) -> AnalysisResult:
    """Extract the scope and the gaps from the session's documents (before approval only)."""
    if scope_locked(session):
        raise Conflict(
            "The scope is approved, so it cannot be analyzed again. Record the change with "
            f"POST /api/v1/sessions/{session.id}/changes."
        )
    documents = [document_to_domain(row) for row in list_documents(db, session.id)]
    if not documents:
        raise ValidationFailed("Add a document to this session before running the analysis.")

    context = build_context(db, session, settings, scenarios_dir)
    # The new analysis replaces the whole scope, so it starts from none: the old items
    # would otherwise hold their ids (FR_01 comes back as FR_02) and feed the gap stage.
    ctx = replace(context.generation, documents=documents, items=[])
    items, findings = analyze_requirements(documents, ctx)
    # The stage assigned the ids already; only the fields the scope service writes are kept.
    keep = set(AnalyzedItem.model_fields)
    analyzed = [AnalyzedItem.model_validate(item.model_dump(include=keep)) for item in items]
    replace_analysis(db, session, analyzed)
    db.refresh(session)
    return AnalysisResult(
        scope=build_view(db, session), findings=findings, mock_notice=context.mock_notice
    )
