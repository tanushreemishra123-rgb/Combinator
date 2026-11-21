"""Fixtures for the AI layer. Live tests only run with RUN_LIVE_TESTS=1."""

import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TypeVar

import pytest
from pydantic import BaseModel

from app.ai.stages.drafts import DraftItem
from app.domain.scope import (
    ItemType,
    Origin,
    Priority,
    ScopeItem,
    Segment,
    SegmentKind,
    SourceDocument,
    SourceRef,
)

T = TypeVar("T", bound=BaseModel)

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "ai"
SCENARIOS = FIXTURES / "scenarios"


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "live: calls the real AI provider")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if os.environ.get("RUN_LIVE_TESTS") == "1":
        return
    skip = pytest.mark.skip(reason="set RUN_LIVE_TESTS=1 to run live provider tests")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)


@dataclass
class ScriptedGenerator:
    """Returns prepared answers per stage; an Exception entry is raised instead."""

    script: dict[str, list[Any]] = field(default_factory=dict)
    label: str = "fake"
    calls: list[tuple[str, str]] = field(default_factory=list)

    def generate(self, stage: str, schema: type[T], system: str, user: str) -> T:
        self.calls.append((stage, user))
        answers = self.script[stage]
        answer = answers.pop(0) if len(answers) > 1 else answers[0]
        if isinstance(answer, Exception):
            raise answer
        return schema.model_validate(answer) if not isinstance(answer, schema) else answer


# The same three paragraphs the journey test writes to its scenario requirements.md.
PARAGRAPHS = (
    "The portal must let customers track shipments in real time.",
    "We expect the system to stay available during business hours.",
    "Shipment status comes from the existing logistics system over its REST API.",
)
REQUIREMENTS_TEXT = "\n\n".join(PARAGRAPHS)


def make_document(doc_id: str = "D1") -> SourceDocument:
    first, second, third = PARAGRAPHS
    text = REQUIREMENTS_TEXT
    return SourceDocument(
        id=doc_id,
        session_id="S1",
        name="requirements.md",
        kind="pasted",
        format="md",
        normalized_text=text,
        segments=[
            Segment(
                segment_id=f"{doc_id}.S1",
                kind=SegmentKind.PARAGRAPH,
                index=0,
                text=first,
                start=0,
                end=len(first),
            ),
            Segment(
                segment_id=f"{doc_id}.S2",
                kind=SegmentKind.PARAGRAPH,
                index=1,
                text=second,
                start=len(first) + 2,
                end=len(first) + 2 + len(second),
            ),
            Segment(
                segment_id=f"{doc_id}.S3",
                kind=SegmentKind.PARAGRAPH,
                index=2,
                text=third,
                start=len(text) - len(third),
                end=len(text),
            ),
        ],
        created_at=datetime.now(UTC),
    )


def make_item(
    item_id: str,
    item_type: ItemType = ItemType.FUNCTIONAL_REQUIREMENT,
    origin: Origin = Origin.CUSTOMER_STATED,
    **kwargs: Any,
) -> ScopeItem:
    now = datetime.now(UTC)
    fields: dict[str, Any] = {
        "id": item_id,
        "type": item_type,
        "title": kwargs.pop("title", f"{item_id} title"),
        "description": kwargs.pop("description", ""),
        "priority": kwargs.pop("priority", Priority.MEDIUM),
        "origin": origin,
        "created_at": now,
        "updated_at": now,
    }
    if origin in (Origin.CUSTOMER_STATED, Origin.AI_INFERRED) and "source_refs" not in kwargs:
        fields["source_refs"] = [
            SourceRef(document_id="D1", segment_id="D1.S1", quote="track shipments", verified=True)
        ]
    fields.update(kwargs)
    return ScopeItem(**fields)


def make_draft(
    temp_id: str,
    item_type: ItemType = ItemType.FUNCTIONAL_REQUIREMENT,
    origin: Origin = Origin.CUSTOMER_STATED,
    **kwargs: Any,
) -> DraftItem:
    """An item as the model proposes it: the domain rules are not applied yet."""
    fields: dict[str, Any] = {
        "temp_id": temp_id,
        "type": item_type,
        "title": kwargs.pop("title", f"{temp_id} title"),
        "origin": origin,
    }
    if origin in (Origin.CUSTOMER_STATED, Origin.AI_INFERRED) and "source_refs" not in kwargs:
        fields["source_refs"] = [
            SourceRef(document_id="D1", segment_id="D1.S1", quote="track shipments", verified=True)
        ]
    fields.update(kwargs)
    return DraftItem(**fields)


@pytest.fixture
def document() -> SourceDocument:
    return make_document()
