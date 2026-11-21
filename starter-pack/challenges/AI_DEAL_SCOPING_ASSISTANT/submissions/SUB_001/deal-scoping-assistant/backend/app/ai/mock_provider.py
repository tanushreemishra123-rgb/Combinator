"""Mock AI provider: recorded responses per scenario, reconciled with the current scope."""

import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

from app.ai.errors import MockResponseMissing
from app.ai.findings import Finding, warning
from app.ai.stages.drafts import ScopeExtraction
from app.ai.validators.id_references import ID_PATTERN
from app.catalogs.paths import SCENARIOS_DIR
from app.domain.scope import ItemStatus, ItemType, ScopeItem

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=BaseModel)

RECORDED = "mock:recorded"
RECORDED_FALLBACK = "mock:recorded-fallback"

# Scope item prefixes; artifact-internal ids (CAP, ARC, IA, ...) are defined in the file itself.
_SCOPE_PREFIXES = tuple(f"{item_type.value}_" for item_type in ItemType)
# Lists the domain requires to stay non-empty, so they keep their stale reference instead.
_PROTECTED_KEYS = {"included_req_ids", "supported_ids"}


@dataclass
class MockGenerator:
    """Serves `seeds/scenarios/<slug>/mock/<stage>[.<variant>].json`."""

    scenario_slug: str = ""
    scenarios_dir: Path = SCENARIOS_DIR
    label: str = RECORDED
    # Set by the generation layer before a stage runs, so recorded ids can be reconciled.
    scope: list[ScopeItem] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    def mock_dir(self) -> Path:
        return self.scenarios_dir / self.scenario_slug / "mock"

    def find_file(self, stage: str) -> tuple[Path, str]:
        """Exact variant, then the base stage, then any recorded variant of that stage."""
        base = stage.split(".", 1)[0]
        directory = self.mock_dir()
        exact = directory / f"{stage}.json"
        if exact.is_file():
            return exact, RECORDED
        plain = directory / f"{base}.json"
        if plain.is_file():
            return plain, RECORDED if base == stage else RECORDED_FALLBACK
        siblings = sorted(directory.glob(f"{base}.*.json"))
        if siblings:
            return siblings[0], RECORDED_FALLBACK
        raise MockResponseMissing(
            f"no recorded response for stage '{stage}' in scenario '{self.scenario_slug}'"
        )

    def generate(self, stage: str, schema: type[T], system: str, user: str) -> T:
        path, label = self.find_file(stage)
        self.label = label
        content = json.loads(path.read_text(encoding="utf-8"))
        # Only generated artifacts reference the approved scope. An extraction answer
        # carries temporary keys that may look like scope ids, so it is replayed as is.
        if isinstance(content, dict) and self.scope and schema is not ScopeExtraction:
            content, findings = reconcile(content, self.scope)
            self.findings.extend(findings)
        return schema.model_validate(content)


def _live_scope_ids(items: Sequence[ScopeItem]) -> set[str]:
    return {item.id for item in items if item.status is not ItemStatus.REJECTED}


def _is_stale(value: Any, live_ids: set[str]) -> bool:
    return (
        isinstance(value, str)
        and value.startswith(_SCOPE_PREFIXES)
        and bool(ID_PATTERN.match(value))
        and value not in live_ids
    )


def _reconcile_node(node: Any, live_ids: set[str], path: str, findings: list[Finding]) -> Any:
    if isinstance(node, dict):
        result: dict[str, Any] = {}
        for key, value in node.items():
            where = f"{path}.{key}" if path else str(key)
            if key.endswith("_ids") and isinstance(value, list):
                kept = [ref for ref in value if not _is_stale(ref, live_ids)]
                dropped = [ref for ref in value if _is_stale(ref, live_ids)]
                if dropped and not kept and key in _PROTECTED_KEYS:
                    # The domain forbids an empty list here, so the element keeps its stale
                    # reference and shows up later as an unsupported addition.
                    findings.append(
                        warning(
                            f"{where}: only removed ids remain ({', '.join(dropped)}); "
                            "this element is an unsupported addition",
                            dropped,
                        )
                    )
                    result[key] = value
                    continue
                if dropped:
                    findings.append(
                        warning(f"{where}: dropped removed ids {', '.join(dropped)}", dropped)
                    )
                result[key] = kept
                continue
            if key.endswith("_id") and key != "id" and _is_stale(value, live_ids):
                findings.append(warning(f"{where}: dropped removed id {value}", [str(value)]))
                result[key] = ""
                continue
            result[key] = _reconcile_node(value, live_ids, where, findings)
        return result
    if isinstance(node, list):
        return [
            _reconcile_node(value, live_ids, f"{path}[{index}]", findings)
            for index, value in enumerate(node)
        ]
    return node


def reconcile(
    content: dict[str, Any], current_scope: Sequence[ScopeItem]
) -> tuple[dict[str, Any], list[Finding]]:
    """Drop references to rejected or deleted scope ids (PLAN section 4).

    Recorded answers were written for the seeded scope. The reviewer may have rejected or
    deleted items since, so references to them are removed before validation. Elements are
    never deleted: they stay and surface as unsupported additions in the coverage view.
    """
    findings: list[Finding] = []
    live_ids = _live_scope_ids(current_scope)
    reconciled = _reconcile_node(content, live_ids, "", findings)
    return dict(reconciled), findings
