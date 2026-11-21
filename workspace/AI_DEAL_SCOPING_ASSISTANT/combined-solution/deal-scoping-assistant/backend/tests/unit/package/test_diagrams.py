"""Mermaid generation: deterministic, escaped and grouped by architecture area."""

from app.package.diagrams import architecture_mermaid, integration_mermaid
from tests.unit.package import fixtures


def test_architecture_diagram_is_deterministic() -> None:
    first = architecture_mermaid(fixtures.architecture())
    second = architecture_mermaid(fixtures.architecture())
    assert first == second


def test_architecture_has_one_subgraph_per_used_area() -> None:
    mermaid = architecture_mermaid(fixtures.architecture())
    subgraphs = [line for line in mermaid.splitlines() if "subgraph AREA_" in line]
    assert len(subgraphs) == 3
    assert 'subgraph AREA_user_facing_applications["User-facing applications"]' in mermaid
    assert mermaid.startswith("flowchart LR")


def test_architecture_labels_escape_breaking_characters() -> None:
    mermaid = architecture_mermaid(fixtures.architecture())
    node_line = next(line for line in mermaid.splitlines() if line.strip().startswith("ARC_01["))
    body = node_line.split("[", 1)[1]
    assert "[primary]" not in body
    assert '"portal"' not in body
    assert "'portal'" in body
    assert "|" not in body
    edge_line = next(line for line in mermaid.splitlines() if "ARC_01 -->" in line)
    assert edge_line.count("|") == 2  # only the two that delimit the edge label
    assert "[profiles]" not in edge_line


def test_architecture_flow_to_unknown_system_becomes_an_external_node() -> None:
    mermaid = architecture_mermaid(fixtures.architecture())
    assert "EXT_Salesforce_CRM" in mermaid


def test_architecture_endpoint_that_is_a_scope_item_id_shows_the_item_title() -> None:
    architecture = fixtures.architecture()
    architecture.flows[1].to_id = "INT_03"
    mermaid = architecture_mermaid(architecture, {"INT_03": "Guidewire ClaimCenter"})
    assert 'EXT_INT_03["Guidewire ClaimCenter"]' in mermaid
    assert "ARC_03 -->" in mermaid


def test_architecture_endpoint_without_a_title_keeps_its_raw_label() -> None:
    mermaid = architecture_mermaid(fixtures.architecture(), {"INT_03": "Guidewire ClaimCenter"})
    assert 'EXT_Salesforce_CRM["Salesforce CRM"]' in mermaid


def test_architecture_component_endpoint_is_not_affected_by_titles() -> None:
    mermaid = architecture_mermaid(fixtures.architecture(), {"ARC_02": "Something else"})
    assert "EXT_ARC_02" not in mermaid
    assert "Something else" not in mermaid
    assert "ARC_01 -->" in mermaid


def test_integration_diagram_uses_ia_ids_and_pattern_labels() -> None:
    integration = fixtures.integration_architecture()
    mermaid = integration_mermaid(integration)
    assert mermaid == integration_mermaid(fixtures.integration_architecture())
    assert 'subgraph IA_INTERNAL["Internal systems"]' in mermaid
    assert 'subgraph IA_EXTERNAL["External systems"]' in mermaid
    assert "IA_01[" in mermaid
    assert "<br/>api" in mermaid
    assert "<-->" in mermaid  # the integration is bidirectional


def test_empty_artifacts_still_produce_a_diagram_header() -> None:
    from app.domain.artifacts import IntegrationArchitecture

    assert integration_mermaid(IntegrationArchitecture()) == "flowchart LR"
