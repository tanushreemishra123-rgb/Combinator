"""Builds the generation context for a session from what is in the database."""

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session as DbSession

from app.ai.context import GenerationContext
from app.ai.provider import get_generator, resolve_ai_runtime
from app.artifacts import service as artifacts
from app.core.config import AiMode, Settings
from app.core.errors import Conflict
from app.db.models import Session as SessionRow
from app.domain.scope import SessionConfig
from app.scope.service import list_rows, to_domain

MOCK_NEEDS_SCENARIO = (
    "Mock mode replays recorded answers and only has them for the sample scenarios. "
    "Start from a sample scenario, or add an AI key to backend/.env to analyze your own text."
)


@dataclass(frozen=True)
class SessionContext:
    """What a generation step needs, plus the notice the UI must show with the result."""

    generation: GenerationContext
    mock_notice: str


def session_config(session: SessionRow) -> SessionConfig:
    return SessionConfig.model_validate(session.config)


def build_context(
    db: DbSession, session: SessionRow, settings: Settings, scenarios_dir: Path
) -> SessionContext:
    """Scope, config, prior artifacts and the generator bound to this session's scenario."""
    runtime = resolve_ai_runtime(settings)
    mock_mode = runtime.mode is AiMode.MOCK
    slug = session.scenario_slug
    notice = runtime.fallback_reason
    if mock_mode and not slug:
        # Replaying another scenario's answers over the user's text would look like an
        # analysis of it and is not one. Refuse with the way forward instead.
        raise Conflict(MOCK_NEEDS_SCENARIO)
    generator = get_generator(settings, scenario_slug=slug, scenarios_dir=scenarios_dir)
    # Rejected items travel with the context: the prompts skip them and the mock
    # reconciliation needs to know which recorded ids are no longer live.
    items = [to_domain(row) for row in list_rows(db, session.id)]
    generation = GenerationContext(
        generator=generator,
        items=items,
        config=session_config(session),
        platform=artifacts.platform_of(session),
        artifacts=artifacts.raw_contents(db, session.id),
        customer_name=session.customer_name,
        opportunity_context=session.opportunity_context,
        max_repair_attempts=settings.ai_max_repair_attempts,
        mock_mode=mock_mode,
    )
    return SessionContext(generation=generation, mock_notice=notice)
