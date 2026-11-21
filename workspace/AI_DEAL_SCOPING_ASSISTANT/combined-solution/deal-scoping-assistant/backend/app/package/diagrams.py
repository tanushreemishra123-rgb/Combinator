"""Deterministic Mermaid diagrams built from the structured artifacts.

Kept small on purpose: two focused diagrams read better than one big one.
Same input always yields the same string.
"""

import re
from collections.abc import Mapping

from app.domain.artifacts import (
    Architecture,
    ArchitectureArea,
    ArchitectureComponent,
    IntegrationArchitecture,
)
from app.domain.scope import IntegrationDirection
from app.package.labels import area_title

ARCHITECTURE_DIAGRAM_ID = "architecture_diagram"
INTEGRATION_DIAGRAM_ID = "integration_diagram"

_NODE_LABEL_MAX = 44
_EDGE_LABEL_MAX = 28
# Characters that end a Mermaid node/edge label or start markup inside one.
_DROP = str.maketrans({c: None for c in "[]{}|<>`#;\\\n\r\t"})
_ID_UNSAFE = re.compile(r"[^A-Za-z0-9_]+")

# Six colour groups so a reader can tell the layers apart at a glance. The fills carry
# alpha, so the same colours read well on a light and on a dark page.
_AREA_GROUP: dict[ArchitectureArea, str] = {
    ArchitectureArea.USER_FACING_APPLICATIONS: "app",
    ArchitectureArea.BACKEND_SERVICES: "app",
    ArchitectureArea.APIS: "app",
    ArchitectureArea.DATABASES_AND_STORAGE: "data",
    ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING: "integration",
    ArchitectureArea.INTEGRATION_COMPONENTS: "integration",
    ArchitectureArea.AI_AND_ML_SERVICES: "ai",
    ArchitectureArea.IDENTITY_AND_ACCESS_MANAGEMENT: "security",
    ArchitectureArea.SECURITY_CONTROLS: "security",
    ArchitectureArea.OBSERVABILITY_AND_MONITORING: "ops",
    ArchitectureArea.DEPLOYMENT_AND_RUNTIME: "ops",
    ArchitectureArea.ENVIRONMENTS_DEV_TEST_PROD: "ops",
    ArchitectureArea.AVAILABILITY_AND_SCALABILITY: "ops",
    ArchitectureArea.BACKUP_AND_DISASTER_RECOVERY: "data",
}
_GROUP_STYLE: dict[str, str] = {
    "app": "fill:#3b82f626,stroke:#3b82f6",
    "data": "fill:#22c55e26,stroke:#22c55e",
    "integration": "fill:#f59e0b26,stroke:#f59e0b",
    "ai": "fill:#8b5cf626,stroke:#8b5cf6",
    "security": "fill:#ef444426,stroke:#ef4444",
    "ops": "fill:#64748b26,stroke:#64748b",
}


def _label(text: str, limit: int) -> str:
    """Make `text` safe inside a quoted Mermaid label and keep it short."""
    cleaned = " ".join(text.replace('"', "'").translate(_DROP).split())
    if len(cleaned) > limit:
        cleaned = cleaned[: limit - 3].rstrip() + "..."
    return cleaned


def _node_id(prefix: str, raw: str) -> str:
    """Stable node id; ARC_/IA_ ids pass through unchanged."""
    safe = _ID_UNSAFE.sub("_", raw).strip("_")
    return safe if safe.startswith(prefix) else f"{prefix}{safe or 'unknown'}"


def _node(node_id: str, *parts: str, indent: str = "    ") -> str:
    label = "<br/>".join(part for part in parts if part)
    return f'{indent}{node_id}["{label}"]'


def _edge(source: str, target: str, label: str, arrow: str = "-->") -> str:
    if label:
        return f'    {source} {arrow}|"{label}"| {target}'
    return f"    {source} {arrow} {target}"


def architecture_mermaid(
    architecture: Architecture, titles: Mapping[str, str] | None = None
) -> str:
    """One subgraph per architecture area that has components, plus the flows between them.

    `titles` maps scope item ids to their titles, so an endpoint like INT_03 reads as a name.
    """
    lines = ["flowchart LR"]
    by_area: dict[str, list[ArchitectureComponent]] = {}
    for component in architecture.components:
        by_area.setdefault(component.area.value, []).append(component)

    known: dict[str, str] = {}  # component id or lowercased name -> node id
    for area_value, components in by_area.items():
        lines.append(
            f'    subgraph AREA_{area_value}["{_label(area_title(components[0].area), 60)}"]'
        )
        for component in components:
            node_id = _node_id("ARC_", component.id)
            known[component.id] = node_id
            known[component.name.strip().lower()] = node_id
            lines.append(
                _node(
                    node_id,
                    _label(component.name, _NODE_LABEL_MAX),
                    _label(component.cloud_service, _NODE_LABEL_MAX),
                    indent="        ",
                )
            )
        lines.append("    end")

    externals: dict[str, str] = {}
    edges: list[str] = []
    for flow in architecture.flows:
        source = _endpoint(flow.from_id, known, externals)
        target = _endpoint(flow.to_id, known, externals)
        edges.append(_edge(source, target, _label(flow.label, _EDGE_LABEL_MAX)))

    by_id = titles or {}
    for raw, node_id in externals.items():
        lines.append(_node(node_id, _label(by_id.get(raw, raw), _NODE_LABEL_MAX)))
    lines.extend(edges)
    lines.extend(_area_styles(by_area))
    return "\n".join(lines)


def _area_styles(by_area: dict[str, list[ArchitectureComponent]]) -> list[str]:
    """One class per colour group; every subgraph and its nodes take their group's style."""
    lines = [f"    classDef {group} {style}" for group, style in _GROUP_STYLE.items()]
    for area_value, components in by_area.items():
        group = _AREA_GROUP[components[0].area]
        members = ",".join([f"AREA_{area_value}", *(_node_id("ARC_", c.id) for c in components)])
        lines.append(f"    class {members} {group}")
    return lines


def _endpoint(ref: str, known: dict[str, str], externals: dict[str, str]) -> str:
    """Flow endpoints may be component ids or names; anything else becomes an external node."""
    node_id = known.get(ref) or known.get(ref.strip().lower())
    if node_id:
        return node_id
    if ref not in externals:
        externals[ref] = _node_id("EXT_", ref)
    return externals[ref]


def integration_mermaid(integration_architecture: IntegrationArchitecture) -> str:
    """Systems as nodes, each integration as an IA_ node carrying its pattern label."""
    lines = ["flowchart LR"]
    systems: dict[str, str] = {}  # lowercased system name -> node id

    for group_id, title, refs in (
        ("IA_INTERNAL", "Internal systems", integration_architecture.internal_systems),
        ("IA_EXTERNAL", "External systems", integration_architecture.external_systems),
    ):
        if not refs:
            continue
        lines.append(f'    subgraph {group_id}["{title}"]')
        for ref in refs:
            node_id = _system_node(ref.name, systems)
            lines.append(_node(node_id, _label(ref.name, _NODE_LABEL_MAX), indent="        "))
        lines.append("    end")

    loose: list[str] = []
    edges: list[str] = []
    for integration in integration_architecture.integrations:
        node_id = _node_id("IA_", integration.id)
        lines.append(
            _node(
                node_id,
                _label(f"{integration.id} {integration.name}", _NODE_LABEL_MAX),
                _label(integration.pattern.value, _EDGE_LABEL_MAX),
            )
        )
        arrow = "<-->" if integration.direction is IntegrationDirection.BIDIRECTIONAL else "-->"
        for name, before in ((integration.source_system, True), (integration.target_system, False)):
            key = name.strip().lower()
            if key not in systems:
                loose.append(_node(_system_node(name, systems), _label(name, _NODE_LABEL_MAX)))
            source, target = (systems[key], node_id) if before else (node_id, systems[key])
            edges.append(_edge(source, target, "", arrow))

    lines.extend(loose)
    lines.extend(edges)
    return "\n".join(lines)


def _system_node(name: str, systems: dict[str, str]) -> str:
    key = name.strip().lower()
    if key not in systems:
        systems[key] = _node_id("SYS_", name.strip().upper())
    return systems[key]
