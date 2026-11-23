"""Prompt loading and the compact JSON views handed to the model."""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.errors import NotFound
from app.domain.scope import ScopeItem, SegmentKind, SessionConfig, SourceDocument

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
GROUNDING_FILE = "_grounding"
DESCRIPTION_CHARS = 200
_WHITESPACE = re.compile(r"\s+")


def normalized_text(text: str) -> str:
    """Whitespace- and case-insensitive form, used to spot the same sentence twice."""
    return _WHITESPACE.sub(" ", text).strip().casefold()


def shorten(text: str, limit: int = DESCRIPTION_CHARS) -> str:
    """Descriptions are capped: every stage pays for them in tokens."""
    text = text.strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


@lru_cache
def load_prompt(name: str) -> str:
    """System prompt for a stage: the shared grounding rules plus the stage prompt."""
    path = PROMPTS_DIR / f"{name}.md"
    if not path.is_file():
        raise NotFound(f"prompt {name}.md is missing")
    text = path.read_text(encoding="utf-8").strip()
    if name == GROUNDING_FILE:
        return text
    return f"{load_prompt(GROUNDING_FILE)}\n\n{text}"


def as_json(payload: Any) -> str:
    """Compact JSON so prompts stay small."""
    return json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":"))


def _clean(payload: dict[str, Any]) -> dict[str, Any]:
    """Drop empty fields; the model does not need to read them."""
    return {key: value for key, value in payload.items() if value not in ("", [], None)}


def item_view(item: ScopeItem) -> dict[str, Any]:
    """One scope item, small enough to send many of them."""
    view: dict[str, Any] = {
        "id": item.id,
        "type": item.type.value,
        "title": item.title,
        "description": shorten(item.description),
        "priority": item.priority.value,
        "origin": item.origin.value,
        "status": item.status.value,
        "tags": item.tags,
        "related_ids": item.related_ids,
    }
    details = item.details
    if details.nfr:
        view["category"] = details.nfr.category.value
    if details.integration:
        view["integration"] = {
            "system": details.integration.system,
            "direction": details.integration.direction.value,
            "pattern": details.integration.pattern.value,
        }
    if details.gap:
        view["criticality"] = details.gap.criticality.value
    if details.assumption:
        view["confirmation_status"] = details.assumption.confirmation_status.value
    if details.question:
        view["answer_status"] = details.question.answer_status.value
        view["answer"] = details.question.answer
    return _clean(view)


def items_view(items: list[ScopeItem]) -> list[dict[str, Any]]:
    return [item_view(item) for item in items]


def documents_view(documents: list[SourceDocument]) -> list[dict[str, Any]]:
    """Documents with their addressable segments; quotes must come from these."""
    return [
        {
            "document_id": document.id,
            "name": document.name,
            "segments": [
                _clean(
                    {
                        "segment_id": segment.segment_id,
                        "heading": segment.heading,
                        "text": segment.text,
                    }
                )
                for segment in document.segments
            ],
        }
        for document in documents
    ]


def outline(documents: list[SourceDocument]) -> list[dict[str, Any]]:
    """Headings only: enough for a stage that works from the extracted items."""
    return [
        {
            "document_id": document.id,
            "name": document.name,
            "headings": [
                segment.text for segment in document.segments if segment.kind is SegmentKind.HEADING
            ],
        }
        for document in documents
    ]


def config_view(config: SessionConfig) -> dict[str, Any]:
    """The user-provided configuration: secondary source in the grounding hierarchy."""
    return _clean(
        {
            "expected_users": config.expected_users,
            "target_regions": config.target_regions,
            "delivery_deadline": config.delivery_deadline,
            "security_level": config.security_level.value,
            "regulatory_constraints": config.regulatory_constraints,
            "ai_provider_preference": (
                config.ai_provider_preference.value if config.ai_provider_preference else None
            ),
            "environments_count": config.environments_count,
            "testing_level": config.testing_level.value,
            "data_migration": config.data_migration.value,
        }
    )


def elements_view(elements: list[dict[str, Any]], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    """Pick a few keys from a prior artifact's elements."""
    return [_clean({key: element.get(key) for key in keys}) for element in elements]
