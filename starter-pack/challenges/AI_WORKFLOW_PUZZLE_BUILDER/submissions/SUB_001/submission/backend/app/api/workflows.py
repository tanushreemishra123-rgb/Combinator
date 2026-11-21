"""Workflow pre-flight validation.

Responsibility: let the builder ask "is this graph runnable?" without starting a
run, and answer with every problem found rather than the first one.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import WorkflowValidationRequest, WorkflowValidationResponse
from app.engine.graph import validate_workflow

router = APIRouter(prefix="/api", tags=["workflows"])


@router.post("/workflows/validate")
async def validate(body: WorkflowValidationRequest) -> WorkflowValidationResponse:
    """Structured errors and warnings for a canvas graph."""
    return WorkflowValidationResponse.of(validate_workflow(body.workflow))
