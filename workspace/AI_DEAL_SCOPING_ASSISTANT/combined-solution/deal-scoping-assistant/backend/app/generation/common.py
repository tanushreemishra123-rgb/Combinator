"""Shared plumbing for the generation functions."""

from dataclasses import replace
from typing import TypeVar

from pydantic import BaseModel

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.ai.mock_provider import MockGenerator
from app.ai.runner import StageRequest, run_stage

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=BaseModel)


def run(ctx: GenerationContext, request: StageRequest[T]) -> tuple[T, list[Finding]]:
    """Run one stage and return its validated result plus the warnings for the reviewer."""
    if note := ctx.update_note():
        request = replace(request, user=f"{request.user}\n\n{note}")
    recorded = ctx.generator if isinstance(ctx.generator, MockGenerator) else None
    if recorded is not None:
        # Recorded answers are reconciled against the scope the reviewer has now.
        recorded.scope = list(ctx.items)
        recorded.findings = []
    result = run_stage(ctx.generator, request, ctx.max_repair_attempts)
    warnings = list(result.warnings)
    if recorded is not None:
        warnings = recorded.findings + warnings
    return result.result, warnings
