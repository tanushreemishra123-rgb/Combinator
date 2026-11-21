"""Reverse index: scope or element id -> the artifact elements that reference it.

The index is driven by an explicit field registry, not by reflection: a new
list-of-id field is picked up by adding one entry below, and nothing else in the
code base has to change. Contents are the plain dicts stored in
`ArtifactEnvelope.content`, so the index works on what the database holds.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from pydantic import ConfigDict, Field

from app.domain.artifacts import ArtifactKind
from app.domain.base import DomainModel


class TraceRef(DomainModel):
    """One reference: artifact element `element_id`.`field` points at `target_id`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    artifact: ArtifactKind = Field(description="Artifact the reference was found in.")
    path: str = Field(description="Content field holding the element, e.g. capabilities.")
    element_id: str = Field(description="Id of the referencing element, e.g. CAP_01.")
    field: str = Field(description="Field that holds the reference, e.g. included_req_ids.")
    target_id: str = Field(description="Id being referenced, e.g. FR_01.")


@dataclass(frozen=True)
class ElementSpec:
    """Where elements live in an artifact content dict and which fields hold ids."""

    path: str
    many: bool = True
    id_fields: tuple[str, ...] = ()
    list_fields: tuple[str, ...] = ()
    single_fields: tuple[str, ...] = ()


_GROUNDED = ("req_ids",)

# Narrative sections that carry req_ids and arc_ids; the section name is the element id.
_ARCH_SECTIONS = (
    "deployment_runtime",
    "availability_scalability",
    "backup_dr",
    "observability",
    "security_controls",
)
_DATA_SECTIONS = (
    "ingestion",
    "transactional_storage",
    "analytical_storage",
    "quality",
    "metadata_governance",
    "retention",
    "privacy_security",
    "reporting_analytics",
    "backup_recovery",
)


def _section_specs(names: Sequence[str]) -> tuple[ElementSpec, ...]:
    return tuple(
        ElementSpec(path=name, many=False, list_fields=("req_ids", "arc_ids")) for name in names
    )


REGISTRY: dict[ArtifactKind, tuple[ElementSpec, ...]] = {
    ArtifactKind.PRD: (
        ElementSpec("objectives", list_fields=_GROUNDED),
        ElementSpec("personas", id_fields=("name",), list_fields=_GROUNDED),
        ElementSpec("user_journeys", id_fields=("name",), list_fields=_GROUNDED),
        ElementSpec(
            "functional_requirements",
            id_fields=("req_id",),
            list_fields=_GROUNDED,
            single_fields=("req_id",),
        ),
        ElementSpec(
            "non_functional_requirements",
            id_fields=("req_id",),
            list_fields=_GROUNDED,
            single_fields=("req_id",),
        ),
        ElementSpec("integrations", list_fields=_GROUNDED),
        ElementSpec("dependencies", list_fields=_GROUNDED),
        ElementSpec("assumptions", list_fields=_GROUNDED),
        ElementSpec("risks", list_fields=_GROUNDED),
        ElementSpec("out_of_scope", list_fields=_GROUNDED),
        ElementSpec("open_questions", list_fields=_GROUNDED),
        ElementSpec("traceability", id_fields=("req_id",), single_fields=("req_id",)),
    ),
    ArtifactKind.FUNCTIONAL_SCOPE: (
        ElementSpec(
            "capabilities",
            id_fields=("id",),
            list_fields=("req_ids", "included_req_ids"),
            single_fields=("workstream_id", "delivery_package_id"),
        ),
        ElementSpec("modules", id_fields=("id",), list_fields=("req_ids", "capability_ids")),
        ElementSpec("workstreams", id_fields=("id",), list_fields=("req_ids", "capability_ids")),
        ElementSpec(
            "delivery_packages", id_fields=("id",), list_fields=("req_ids", "capability_ids")
        ),
        ElementSpec("out_of_scope", list_fields=_GROUNDED),
        ElementSpec(
            "recommended_enhancements",
            id_fields=("id",),
            list_fields=("req_ids", "related_req_ids"),
        ),
    ),
    ArtifactKind.PLATFORM_RECOMMENDATION: (
        ElementSpec("platform_recommendation", many=False, list_fields=_GROUNDED),
    ),
    ArtifactKind.ARCHITECTURE: (
        ElementSpec(
            "components", id_fields=("id",), list_fields=("req_ids", "supported_ids", "arc_ids")
        ),
        ElementSpec("platform_recommendation", many=False, list_fields=_GROUNDED),
        *_section_specs(_ARCH_SECTIONS),
    ),
    ArtifactKind.DATA_STRATEGY: (
        ElementSpec("domains", id_fields=("id",), list_fields=("req_ids", "arc_ids")),
        *_section_specs(_DATA_SECTIONS),
    ),
    ArtifactKind.INTEGRATION_ARCHITECTURE: (
        ElementSpec("integrations", id_fields=("id",), list_fields=("req_ids", "arc_ids")),
        ElementSpec("internal_systems", id_fields=("name",), list_fields=_GROUNDED),
        ElementSpec("external_systems", id_fields=("name",), list_fields=_GROUNDED),
    ),
    ArtifactKind.AI_STRATEGY: (
        ElementSpec("ai_requirements", list_fields=_GROUNDED),
        ElementSpec("use_cases", id_fields=("id",), list_fields=_GROUNDED),
        ElementSpec("deterministic_areas", list_fields=_GROUNDED),
        ElementSpec("mandatory_human_decisions", list_fields=_GROUNDED),
        ElementSpec("framework_recommendations", id_fields=("name",), list_fields=_GROUNDED),
    ),
    ArtifactKind.ESTIMATE_DRIVERS: (
        ElementSpec("units", id_fields=("unit_id",), single_fields=("unit_id", "workstream_id")),
        ElementSpec(
            "workstreams",
            id_fields=("id",),
            list_fields=(
                "req_ids",
                "capability_ids",
                "integration_ids",
                "ai_use_case_ids",
                "arc_ids",
                "domain_ids",
            ),
        ),
        ElementSpec("phases", id_fields=("name",), list_fields=("workstream_ids",)),
        ElementSpec("delivery_risks", list_fields=_GROUNDED),
        ElementSpec("estimation_assumptions", list_fields=_GROUNDED),
        ElementSpec("exclusions", list_fields=_GROUNDED),
    ),
    ArtifactKind.ESTIMATE: (
        ElementSpec("workstreams", id_fields=("workstream_id",), list_fields=("req_ids",)),
    ),
    ArtifactKind.EXECUTIVE_SUMMARY: (
        ElementSpec("customer_objectives", list_fields=_GROUNDED),
        ElementSpec("solution_highlights", list_fields=_GROUNDED),
        ElementSpec("key_risks", list_fields=_GROUNDED),
        ElementSpec("next_steps", list_fields=_GROUNDED),
    ),
}


def string_list(value: Any) -> list[str]:
    """Non-empty strings of a content field that should hold a list of ids."""
    if not isinstance(value, list):
        return []
    return [entry for entry in value if isinstance(entry, str) and entry]


class UnknownArtifactPath(Exception):
    """Raised when a caller asks for a content path that is not in the registry."""


def _element_id(spec: ElementSpec, element: Mapping[str, Any], position: int) -> str:
    for name in spec.id_fields:
        value = element.get(name)
        if isinstance(value, str) and value:
            return value
    return spec.path if not spec.many else f"{spec.path}[{position}]"


def _elements(content: Mapping[str, Any], spec: ElementSpec) -> list[tuple[str, Mapping[str, Any]]]:
    value = content.get(spec.path)
    if spec.many:
        if not isinstance(value, list):
            return []
        return [
            (_element_id(spec, item, i), item)
            for i, item in enumerate(value)
            if isinstance(item, Mapping)
        ]
    if not isinstance(value, Mapping):
        return []
    return [(_element_id(spec, value, 0), value)]


def _refs(
    kind: ArtifactKind, spec: ElementSpec, element_id: str, element: Mapping[str, Any]
) -> list[TraceRef]:
    refs: list[TraceRef] = []
    for name in spec.list_fields:
        values = element.get(name)
        if not isinstance(values, list):
            continue
        for target in values:
            if isinstance(target, str) and target:
                refs.append(
                    TraceRef(
                        artifact=kind,
                        path=spec.path,
                        element_id=element_id,
                        field=name,
                        target_id=target,
                    )
                )
    for name in spec.single_fields:
        target = element.get(name)
        if isinstance(target, str) and target:
            refs.append(
                TraceRef(
                    artifact=kind,
                    path=spec.path,
                    element_id=element_id,
                    field=name,
                    target_id=target,
                )
            )
    return refs


@dataclass(frozen=True)
class TraceIndex:
    """Flat list of references plus the two lookups every caller needs."""

    refs: tuple[TraceRef, ...]
    by_target: Mapping[str, tuple[TraceRef, ...]]
    by_element: Mapping[tuple[ArtifactKind, str], tuple[TraceRef, ...]]

    def references(self, target_id: str) -> tuple[TraceRef, ...]:
        """Every artifact element that points at `target_id`."""
        return self.by_target.get(target_id, ())

    def referenced_ids(self, artifact: ArtifactKind, element_id: str) -> tuple[str, ...]:
        """Ids referenced by one element, in first-seen order."""
        seen: dict[str, None] = {}
        for ref in self.by_element.get((artifact, element_id), ()):
            seen.setdefault(ref.target_id, None)
        return tuple(seen)

    def artifacts_referencing(self, target_id: str) -> set[ArtifactKind]:
        return {ref.artifact for ref in self.references(target_id)}

    def element_ids(self, artifact: ArtifactKind, path: str | None = None) -> tuple[str, ...]:
        """Element ids known for an artifact, optionally restricted to one content path."""
        seen: dict[str, None] = {}
        for ref in self.refs:
            if ref.artifact is artifact and (path is None or ref.path == path):
                seen.setdefault(ref.element_id, None)
        return tuple(seen)


def build_index(contents: Mapping[ArtifactKind, Mapping[str, Any]]) -> TraceIndex:
    """Build the reverse index over every artifact content passed in."""
    refs: list[TraceRef] = []
    for kind, content in contents.items():
        for spec in REGISTRY.get(kind, ()):
            for element_id, element in _elements(content, spec):
                refs.extend(_refs(kind, spec, element_id, element))

    by_target: dict[str, list[TraceRef]] = {}
    by_element: dict[tuple[ArtifactKind, str], list[TraceRef]] = {}
    for ref in refs:
        by_target.setdefault(ref.target_id, []).append(ref)
        by_element.setdefault((ref.artifact, ref.element_id), []).append(ref)
    return TraceIndex(
        refs=tuple(refs),
        by_target={key: tuple(value) for key, value in by_target.items()},
        by_element={key: tuple(value) for key, value in by_element.items()},
    )


def iter_elements(
    contents: Mapping[ArtifactKind, Mapping[str, Any]], kind: ArtifactKind, path: str
) -> list[tuple[str, Mapping[str, Any]]]:
    """Elements at `path` as (element_id, element); empty when the artifact is absent.

    Used where an element with zero references still matters, for example an
    unsupported capability.
    """
    specs = {spec.path: spec for spec in REGISTRY.get(kind, ())}
    spec = specs.get(path)
    if spec is None:
        raise UnknownArtifactPath(f"{kind}.{path} is not in the traceability registry")
    content = contents.get(kind)
    if content is None:
        return []
    return _elements(content, spec)
