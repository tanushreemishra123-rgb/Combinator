"""Generates one artifact, after checking that everything it builds on exists."""

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path

from pydantic import Field
from sqlalchemy.orm import Session as DbSession

from app.ai.context import GenerationContext
from app.ai.findings import Finding
from app.artifacts import service as artifacts
from app.core.config import Settings
from app.core.errors import Conflict
from app.db.models import Session as SessionRow
from app.domain.artifacts import ArtifactEnvelope, ArtifactKind, PlatformRecommendation
from app.domain.base import DomainModel
from app.domain.scope import CloudPlatform, PlatformMode, ScopeStatus, SessionUpdate
from app.generation.ai_strategy import generate_ai_strategy
from app.generation.architecture import generate_architecture, recommend_platform
from app.generation.data_strategy import generate_data_strategy
from app.generation.estimate_drivers import generate_estimate_drivers
from app.generation.functional_scope import generate_functional_scope
from app.generation.integration import generate_integration_architecture
from app.generation.prd import generate_prd
from app.generation.summary import generate_executive_summary
from app.sessions.service import update_session
from app.workflow import estimate as estimate_service
from app.workflow.context import SessionContext, build_context

# What each kind is built from; checked before the model is called.
PREREQUISITES: dict[ArtifactKind, tuple[ArtifactKind, ...]] = {
    ArtifactKind.PRD: (),
    ArtifactKind.FUNCTIONAL_SCOPE: (ArtifactKind.PRD,),
    ArtifactKind.PLATFORM_RECOMMENDATION: (),
    ArtifactKind.ARCHITECTURE: (ArtifactKind.FUNCTIONAL_SCOPE,),
    ArtifactKind.DATA_STRATEGY: (ArtifactKind.ARCHITECTURE,),
    ArtifactKind.INTEGRATION_ARCHITECTURE: (ArtifactKind.ARCHITECTURE,),
    ArtifactKind.AI_STRATEGY: (ArtifactKind.ARCHITECTURE,),
    ArtifactKind.ESTIMATE_DRIVERS: (
        ArtifactKind.FUNCTIONAL_SCOPE,
        ArtifactKind.ARCHITECTURE,
        ArtifactKind.INTEGRATION_ARCHITECTURE,
        ArtifactKind.AI_STRATEGY,
    ),
    ArtifactKind.EXECUTIVE_SUMMARY: (ArtifactKind.ESTIMATE,),
}

_SIMPLE_STAGES: dict[ArtifactKind, Callable[[GenerationContext], tuple[DomainModel, list[Finding]]]]
_SIMPLE_STAGES = {
    ArtifactKind.PRD: generate_prd,
    ArtifactKind.FUNCTIONAL_SCOPE: generate_functional_scope,
    ArtifactKind.PLATFORM_RECOMMENDATION: recommend_platform,
    ArtifactKind.DATA_STRATEGY: generate_data_strategy,
    ArtifactKind.INTEGRATION_ARCHITECTURE: generate_integration_architecture,
    ArtifactKind.AI_STRATEGY: generate_ai_strategy,
    ArtifactKind.ESTIMATE_DRIVERS: generate_estimate_drivers,
}


class GenerateOptions(DomainModel):
    platform: CloudPlatform | None = Field(
        default=None, description="Platform to design for; defaults to the session's."
    )
    recommend: bool = Field(
        default=False, description="Ask the model to pick the platform before designing."
    )


class GenerateResult(DomainModel):
    artifact: ArtifactEnvelope = Field(description="The stored artifact.")
    warnings: list[Finding] = Field(
        default_factory=list, description="Validator findings that did not block the stage."
    )
    mock_notice: str = Field(default="", description="Set when recorded answers are replayed.")


def ensure_approved(session: SessionRow) -> None:
    if session.scope_status != ScopeStatus.APPROVED.value:
        raise Conflict(
            "The scope must be reviewed and approved before anything is generated. "
            f"Approve it with POST /api/v1/sessions/{session.id}/scope/approve."
        )


def ensure_prerequisites(db: DbSession, session: SessionRow, kind: ArtifactKind) -> None:
    for needed in PREREQUISITES[kind]:
        if artifacts.has(db, session.id, needed):
            continue
        if needed is ArtifactKind.ESTIMATE:
            raise Conflict(
                f"The {kind.value} needs the estimate. Calculate it with "
                f"POST /api/v1/sessions/{session.id}/estimate/calculate."
            )
        raise Conflict(
            f"The {kind.value} needs the {needed.value} first. Generate it with "
            f"POST /api/v1/sessions/{session.id}/artifacts/{needed.value}/generate."
        )


def _resolve_platform(
    db: DbSession, session: SessionRow, options: GenerateOptions, context: SessionContext
) -> tuple[CloudPlatform, PlatformRecommendation | None, list[Finding]]:
    """The platform to design for: recommended now, passed in, or already on the session."""
    current = artifacts.platform_of(session)
    if options.recommend and current is not None:
        raise Conflict(
            "This session already has a cloud platform, and a new recommendation could "
            "replace it without recording the impact. Change the platform with "
            f"POST /api/v1/sessions/{session.id}/changes."
        )
    if options.recommend:
        recommendation, findings = recommend_platform(context.generation)
        artifacts.store(
            db,
            session,
            ArtifactKind.PLATFORM_RECOMMENDATION,
            recommendation.model_dump(mode="json"),
            context.generation.generator.label,
        )
        update_session(
            db,
            session,
            SessionUpdate(
                cloud_platform=recommendation.recommended,
                platform_mode=PlatformMode.RECOMMENDED,
            ),
            allow_locked=True,
        )
        return recommendation.recommended, recommendation, findings
    if options.platform is not None and current is not None and options.platform is not current:
        raise Conflict(
            "The cloud platform is already set for this session, so changing it must be "
            f"recorded with its impact. Send it to POST /api/v1/sessions/{session.id}/changes."
        )
    target = options.platform or current
    if target is None:
        raise Conflict(
            "The architecture needs a cloud platform. Select one on the session, pass "
            "'platform' in the body, or pass 'recommend': true."
        )
    if current is None:
        update_session(
            db,
            session,
            SessionUpdate(cloud_platform=target, platform_mode=PlatformMode.SELECTED),
            allow_locked=True,
        )
    return target, None, []


def _generate_architecture(
    db: DbSession, session: SessionRow, options: GenerateOptions, context: SessionContext
) -> tuple[DomainModel, list[Finding]]:
    platform, recommendation, findings = _resolve_platform(db, session, options, context)
    # The recorded answers are kept per platform, so the variant selects the right file.
    ctx = replace(context.generation, platform=platform, variant=platform.value)
    architecture, stage_findings = generate_architecture(ctx, platform, recommendation)
    return architecture, [*findings, *stage_findings]


def generate(
    db: DbSession,
    session: SessionRow,
    kind: ArtifactKind,
    options: GenerateOptions,
    settings: Settings,
    scenarios_dir: Path,
    change_description: str = "",
) -> GenerateResult:
    """Run the stage for one artifact kind and store the validated result.

    With `change_description` the stage is asked for a controlled update: it sees the
    previous version and what changed, so reviewed content it does not have to touch stays.
    """
    if kind is ArtifactKind.ESTIMATE:
        raise Conflict(
            "The estimate is calculated from the drivers, not generated. Use "
            f"POST /api/v1/sessions/{session.id}/estimate/calculate."
        )
    ensure_approved(session)
    ensure_prerequisites(db, session, kind)

    context = build_context(db, session, settings, scenarios_dir)
    if change_description:
        previous = artifacts.get_row(db, session.id, kind)
        context = SessionContext(
            generation=replace(
                context.generation,
                change_description=change_description,
                previous_content=dict(previous.content) if previous is not None else None,
            ),
            mock_notice=context.mock_notice,
        )
    if kind is ArtifactKind.ARCHITECTURE:
        content, warnings = _generate_architecture(db, session, options, context)
    elif kind is ArtifactKind.EXECUTIVE_SUMMARY:
        summary = estimate_service.get(db, session.id)
        content, warnings = generate_executive_summary(
            context.generation, estimate_service.commercial_summary(summary)
        )
    else:
        content, warnings = _SIMPLE_STAGES[kind](context.generation)

    db.refresh(session)
    envelope = artifacts.store(
        db, session, kind, content.model_dump(mode="json"), context.generation.generator.label
    )
    return GenerateResult(artifact=envelope, warnings=warnings, mock_notice=context.mock_notice)
