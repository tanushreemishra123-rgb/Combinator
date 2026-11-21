"""Warn when an applicable architecture area has no component."""

from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, warning
from app.domain.artifacts import ArchitectureArea
from app.domain.scope import IntegrationPattern, ItemType

# Two areas only apply when the scope asks for them; the other twelve always apply.
_MESSAGING_TAGS = {"messaging", "events", "streaming", "event"}
_AI_TAGS = {"ai", "ml", "machine-learning"}
_CONDITIONAL = {
    ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING,
    ArchitectureArea.AI_AND_ML_SERVICES,
}


def applicable_areas(items: Sequence[Any]) -> set[ArchitectureArea]:
    """The areas this solution should cover, given the approved scope."""
    areas = {area for area in ArchitectureArea if area not in _CONDITIONAL}
    for item in items:
        tags = {tag.lower() for tag in item.tags}
        integration = item.details.integration
        if tags & _MESSAGING_TAGS or (
            item.type is ItemType.INTEGRATION
            and integration is not None
            and integration.pattern is IntegrationPattern.EVENT
        ):
            areas.add(ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING)
        if tags & _AI_TAGS:
            areas.add(ArchitectureArea.AI_AND_ML_SERVICES)
    return areas


def check_architecture_areas(architecture: Any, expected: set[ArchitectureArea]) -> list[Finding]:
    covered = {component.area for component in architecture.components}
    missing = sorted(area.value for area in expected - covered)
    if not missing:
        return []
    return [warning(f"no architecture component covers these areas: {', '.join(missing)}")]
