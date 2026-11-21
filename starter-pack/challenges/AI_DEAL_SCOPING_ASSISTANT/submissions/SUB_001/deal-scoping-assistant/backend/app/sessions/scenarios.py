"""Seeded demo scenarios: list them and start a session from one."""

import json
import re
from datetime import date
from pathlib import Path

from pydantic import Field, JsonValue
from sqlalchemy.orm import Session as DbSession

from app.core.config import Settings
from app.core.errors import NotFound, ValidationFailed
from app.db.models import Session as SessionRow
from app.domain.base import DomainModel
from app.domain.scope import (
    CloudPlatform,
    PlatformMode,
    SessionConfig,
    SessionCreate,
)
from app.ingestion.service import add_pasted_document
from app.sessions.service import create_session

SLUG_PATTERN = re.compile(r"^[a-z0-9-]+$")
CONTEXT_FILE = "context.json"
REQUIREMENTS_FILE = "requirements.md"
_SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds" / "scenarios"


class ScenarioDemoChange(DomainModel):
    description: str = Field(description="The canonical change used in the demo.")
    config_key: str = Field(description="Config key or scope field the change touches.")
    from_value: JsonValue = Field(default=None, alias="from", description="Value before.")
    to_value: JsonValue = Field(default=None, alias="to", description="Value after.")


class Scenario(DomainModel):
    slug: str = Field(description="Folder name and url segment of the scenario.")
    title: str = Field(description="Scenario title, used as the session name.")
    scenario_type: str = Field(description="Kind of opportunity the scenario represents.")
    customer_name: str = Field(description="Customer in the scenario.")
    industry: str = Field(description="Customer industry.")
    opportunity_summary: str = Field(description="Short context for the opportunity.")
    requested_by: str = Field(description="Who asked for the solution.")
    preferred_cloud: CloudPlatform | None = Field(
        default=None, description="Stated cloud preference; null asks for a recommendation."
    )
    expected_users: int | None = Field(default=None, description="Expected user volume, if known.")
    target_regions: list[str] = Field(default_factory=list, description="Regions to serve.")
    delivery_deadline: date | None = Field(
        default=None, description="Required delivery date, when the scenario states one."
    )
    regulatory_constraints: list[str] = Field(
        default_factory=list, description="Regulations named in the scenario."
    )
    demo_change: ScenarioDemoChange = Field(description="Change used to demo change impact.")


def get_scenarios_dir() -> Path:
    """Dependency so tests can point the API at a temporary seeds directory."""
    return _SEEDS_DIR


def list_scenarios(root: Path) -> list[Scenario]:
    if not root.is_dir():
        return []
    scenarios = []
    for entry in sorted(root.iterdir()):
        if entry.is_dir() and SLUG_PATTERN.fullmatch(entry.name):
            context = entry / CONTEXT_FILE
            if context.is_file():
                scenarios.append(_read_context(context))
    return scenarios


def load_scenario(root: Path, slug: str) -> tuple[Scenario, str]:
    """Scenario plus its requirements text; the slug is checked before it touches a path."""
    directory = _scenario_dir(root, slug)
    requirements = directory / REQUIREMENTS_FILE
    if not requirements.is_file():
        raise NotFound(f"Scenario '{slug}' has no {REQUIREMENTS_FILE}.")
    return _read_context(directory / CONTEXT_FILE), requirements.read_text(encoding="utf-8")


def create_session_from_scenario(
    db: DbSession, root: Path, slug: str, settings: Settings
) -> SessionRow:
    scenario, requirements = load_scenario(root, slug)
    payload = SessionCreate(
        name=scenario.title,
        customer_name=scenario.customer_name,
        opportunity_context=scenario.opportunity_summary,
        cloud_platform=scenario.preferred_cloud,
        platform_mode=(
            PlatformMode.SELECTED if scenario.preferred_cloud else PlatformMode.RECOMMENDED
        ),
        config=SessionConfig(
            expected_users=scenario.expected_users,
            target_regions=list(scenario.target_regions),
            delivery_deadline=scenario.delivery_deadline,
            regulatory_constraints=list(scenario.regulatory_constraints),
        ),
    )
    session = create_session(db, payload, settings, scenario_slug=slug)
    add_pasted_document(db, session, name=REQUIREMENTS_FILE, text=requirements, settings=settings)
    return session


def _scenario_dir(root: Path, slug: str) -> Path:
    if not SLUG_PATTERN.fullmatch(slug):
        raise NotFound(f"Scenario '{slug}' does not exist.")
    directory = root / slug
    # The slug cannot contain a separator, but confirm the path stays inside the seeds dir.
    if not directory.resolve().is_relative_to(root.resolve()) or not directory.is_dir():
        raise NotFound(f"Scenario '{slug}' does not exist.")
    if not (directory / CONTEXT_FILE).is_file():
        raise NotFound(f"Scenario '{slug}' does not exist.")
    return directory


def _read_context(path: Path) -> Scenario:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationFailed(f"Scenario file '{path.name}' could not be read.") from exc
    return Scenario.model_validate(data)
