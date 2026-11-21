"""Input state for the change-impact rules.

The output is the shared `app.domain.changes.ChangeRecord`; only the input view
of a session lives here, because nothing outside this package produces it.
"""

from typing import Any

from pydantic import Field

from app.domain.artifacts import ArtifactKind
from app.domain.base import DomainModel
from app.domain.scope import CloudPlatform, ScopeItem, SessionConfig


class SessionState(DomainModel):
    """Everything the rules need about a session at one point in time."""

    session_id: str = Field(description="Session id.")
    scope_version: int = Field(description="Scope version of this state.")
    cloud_platform: CloudPlatform | None = Field(
        default=None, description="Selected or recommended cloud platform."
    )
    config: SessionConfig = Field(
        default_factory=SessionConfig, description="Session configuration."
    )
    items: list[ScopeItem] = Field(default_factory=list, description="Scope items.")
    artifacts: dict[ArtifactKind, dict[str, Any]] = Field(
        default_factory=dict, description="Artifact contents by kind, as stored."
    )
