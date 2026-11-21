"""What a stage needs to run: scope, config, prior artifacts and the generator."""

import json
from dataclasses import dataclass, field
from typing import Any, TypeVar

from app.ai.findings import FindingLevel
from app.ai.provider import StructuredGenerator
from app.ai.validators.id_references import collect_references
from app.domain.artifacts import ArtifactKind
from app.domain.base import DomainModel
from app.domain.scope import (
    CloudPlatform,
    ItemStatus,
    ItemType,
    ScopeItem,
    SessionConfig,
    SourceDocument,
)

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=DomainModel)


@dataclass
class GenerationContext:
    """Everything the generation functions read; nothing here touches the database."""

    generator: StructuredGenerator
    items: list[ScopeItem] = field(default_factory=list)
    documents: list[SourceDocument] = field(default_factory=list)
    config: SessionConfig = field(default_factory=SessionConfig)
    platform: CloudPlatform | None = None
    artifacts: dict[ArtifactKind, dict[str, Any]] = field(default_factory=dict)
    customer_name: str = ""
    opportunity_context: str = ""
    max_repair_attempts: int = 2
    mock_mode: bool = False
    variant: str = ""
    # Set for a controlled update after a change (PLAN section 7).
    previous_content: dict[str, Any] | None = None
    change_description: str = ""

    def active_items(self) -> list[ScopeItem]:
        """Items the reviewer has not rejected."""
        return [item for item in self.items if item.status is not ItemStatus.REJECTED]

    def items_of(self, *types: ItemType) -> list[ScopeItem]:
        return [item for item in self.active_items() if item.type in types]

    def known_ids(self) -> set[str]:
        """Scope ids plus every element id defined by an already generated artifact."""
        ids = {item.id for item in self.active_items()}
        for content in self.artifacts.values():
            defined, _ = collect_references(content)
            ids |= defined
        return ids

    def reference_level(self) -> FindingLevel:
        """Recorded mock answers may lag behind edits, so id problems are warnings there."""
        return FindingLevel.WARNING if self.mock_mode else FindingLevel.ERROR

    def artifact(self, kind: ArtifactKind) -> dict[str, Any]:
        return self.artifacts.get(kind, {})

    def artifact_as(self, kind: ArtifactKind, model: type[T]) -> T | None:
        """Prior artifact content parsed into its domain model, when it exists."""
        content = self.artifacts.get(kind)
        return model.model_validate(content) if content else None

    def update_note(self) -> str:
        """Extra instruction for a regeneration after a change; empty for a first run."""
        if not self.change_description:
            return ""
        keep_the_rest = (
            "Change only what this change affects. Keep every other element, its wording "
            "and its id exactly as it is."
        )
        lines = [
            "This is a controlled update of a document that was already reviewed.",
            f"What changed: {self.change_description}",
            keep_the_rest,
        ]
        if self.previous_content is not None:
            lines.append("Previous version of this document:")
            lines.append(json.dumps(self.previous_content, ensure_ascii=False, default=str))
        return "\n".join(lines)

    def stage_key(self, stage: str) -> str:
        """Stage name used for mock lookup; the variant selects a recorded file."""
        return f"{stage}.{self.variant}" if self.variant else stage
