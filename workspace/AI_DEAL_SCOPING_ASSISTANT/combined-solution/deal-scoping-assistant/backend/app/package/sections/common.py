"""Shared context and helpers used by every section builder."""

from collections.abc import Iterator, Sequence
from dataclasses import dataclass

from pydantic import BaseModel

from app.domain.artifacts import (
    Architecture,
    Element,
    Flow,
    NarrativeSection,
    OutOfScopeItem,
    Statement,
)
from app.domain.estimation import Estimate, TraceEntry
from app.domain.package import Block
from app.domain.quality import QualityReport
from app.domain.scope import ItemType, ScopeItem, SessionRead
from app.package.blocks import bullets, heading, paragraph, table
from app.package.inputs import PackageArtifacts
from app.package.labels import humanise, with_grounding
from app.traceability.coverage import CoverageReport

NONE = "-"
REQUIREMENT_HEADERS = ["ID", "Type", "Priority", "Origin", "Description", "Source quote"]


@dataclass(frozen=True)
class Ctx:
    """Everything a section builder may read."""

    session: SessionRead
    items: list[ScopeItem]
    artifacts: PackageArtifacts
    estimate: Estimate | None
    coverage: CoverageReport | None
    quality: QualityReport | None

    def of_type(self, item_type: ItemType) -> list[ScopeItem]:
        return [item for item in self.items if item.type is item_type]


def item_titles(ctx: Ctx) -> dict[str, str]:
    """Scope item id -> title, so diagrams can name an id instead of printing it."""
    return {item.id: item.title for item in ctx.items}


def text(value: str) -> str:
    return value.strip() or NONE


def join(values: Sequence[str]) -> str:
    return ", ".join(v for v in values if v) or NONE


def quote(item: ScopeItem) -> str:
    if item.source_refs:
        ref = item.source_refs[0]
        suffix = "" if ref.verified else " (unverified)"
        return f'"{ref.quote}" ({ref.document_id}/{ref.segment_id}){suffix}'
    return item.absence_note.strip() or NONE


def requirement_rows(items: Sequence[ScopeItem]) -> list[list[str]]:
    return [
        [
            item.id,
            item.type.value,
            humanise(item.priority),
            humanise(item.origin),
            text(item.description or item.title),
            quote(item),
        ]
        for item in items
    ]


def requirement_table(items: Sequence[ScopeItem]) -> Block:
    return table(REQUIREMENT_HEADERS, requirement_rows(items))


def statement_bullets(statements: Sequence[Statement]) -> Block:
    return bullets([with_grounding(s.text, s) for s in statements])


def out_of_scope_bullets(entries: Sequence[OutOfScopeItem]) -> Block:
    return bullets([with_grounding(f"{e.text} - {e.reason}", e) for e in entries])


def flow_table(flows: Sequence[Flow]) -> Block:
    return table(
        ["From", "To", "What moves", "Protocol"],
        [[f.from_id, f.to_id, text(f.label), text(f.protocol)] for f in flows],
    )


def services_for(arc_ids: Sequence[str], architecture: Architecture | None) -> str:
    """Strategies are platform neutral; service names are resolved from the architecture here."""
    if not arc_ids:
        return ""
    if architecture is None:
        return "not resolved, the architecture has not been generated yet"
    by_id = {component.id: component for component in architecture.components}
    resolved = [
        f"{by_id[arc_id].name} ({by_id[arc_id].cloud_service})"
        if arc_id in by_id
        else f"{arc_id} (unknown component)"
        for arc_id in arc_ids
    ]
    return "; ".join(resolved)


def narrative(
    title: str, section: NarrativeSection, architecture: Architecture | None
) -> list[Block]:
    out = [heading(title, 3), paragraph(with_grounding(section.text, section))]
    services = services_for(section.arc_ids, architecture)
    if services:
        out.append(paragraph(f"Cloud services: {services}"))
    return out


def iter_elements(value: object) -> Iterator[Element]:
    """Walk an artifact model for grounded elements; used for the validation list."""
    if isinstance(value, Element):
        yield value
    if isinstance(value, BaseModel):
        for field_value in value.__dict__.values():
            yield from iter_elements(field_value)
    elif isinstance(value, list):
        for entry in value:
            yield from iter_elements(entry)


def element_label(element: Element) -> str:
    for attribute in ("id", "name", "text"):
        value = getattr(element, attribute, "")
        if isinstance(value, str) and value.strip():
            return value.strip()[:120]
    return element.__class__.__name__


def artifact_models(artifacts: PackageArtifacts) -> list[tuple[str, BaseModel]]:
    named = [
        ("Executive summary", artifacts.executive_summary),
        ("PRD", artifacts.prd),
        ("Functional scope", artifacts.functional_scope),
        ("Architecture", artifacts.architecture),
        ("Data strategy", artifacts.data_strategy),
        ("Integration architecture", artifacts.integration_architecture),
        ("AI strategy", artifacts.ai_strategy),
        ("Estimate drivers", artifacts.estimate_drivers),
    ]
    return [(name, model) for name, model in named if model is not None]


def trace_rows(entries: Sequence[TraceEntry], prefix: str = "") -> list[list[str]]:
    rows = []
    for entry in entries:
        inputs = "; ".join(f"{i.name} = {i.value}" for i in entry.inputs) or NONE
        row = [entry.label, entry.formula, inputs, f"{entry.result:g}"]
        rows.append([prefix, *row] if prefix else row)
    return rows
