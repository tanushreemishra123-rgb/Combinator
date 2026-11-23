"""The document model: spec section order, grounding labels and graceful gaps."""

import re

import pytest

from app.domain.package import DISCLAIMER, BlockType, DocumentModel
from app.package.blocks import NOT_GENERATED
from app.package.builder import build_package
from app.package.inputs import PackageArtifacts
from tests.unit.package import fixtures

# Fixture copy of seeds/documents/package_outline.json: the spec's package contents
# (challenge FR6) plus the pre-export quality gate.
EXPECTED_SECTIONS = [
    ("PKG_01", "Executive summary"),
    ("PKG_02", "Customer objectives"),
    ("PKG_03", "Requirement summary"),
    ("PKG_04", "PRD"),
    ("PKG_05", "Functional scope"),
    ("PKG_06", "Solution architecture"),
    ("PKG_07", "Architecture diagram"),
    ("PKG_08", "Data strategy"),
    ("PKG_09", "Integration architecture"),
    ("PKG_10", "AI solution approach"),
    ("PKG_11", "Recommended technologies and frameworks"),
    ("PKG_12", "Delivery phases and workstreams"),
    ("PKG_13", "Effort and timeline estimate"),
    ("PKG_14", "ROM commercials"),
    ("PKG_15", "Assumptions"),
    ("PKG_16", "Risks"),
    ("PKG_17", "Dependencies"),
    ("PKG_18", "Open questions"),
    ("PKG_19", "Requirement coverage"),
    ("PKG_20", "Traceability information"),
    ("PKG_21", "Quality gate results"),
]


def full_document() -> DocumentModel:
    return build_package(
        session=fixtures.session(),
        scope_items=fixtures.scope_items(),
        artifacts=fixtures.artifacts(),
        estimate=fixtures.estimate(),
        coverage=fixtures.coverage_report(),
        quality_report=fixtures.quality_report(),
        generated_at=fixtures.NOW,
    )


def empty_document() -> DocumentModel:
    return build_package(
        session=fixtures.session(),
        scope_items=[],
        artifacts=PackageArtifacts(),
        estimate=None,
        coverage=None,
        quality_report=None,
        generated_at=fixtures.NOW,
    )


def section_text(document: DocumentModel, section_id: str) -> str:
    section = next(s for s in document.sections if s.id == section_id)
    parts = []
    for block in section.blocks:
        parts += [block.text, *block.items, *block.headers]
        for row in block.rows:
            parts += row
    return "\n".join(parts)


def test_section_order_matches_the_outline() -> None:
    document = full_document()
    assert [(s.id, s.title) for s in document.sections] == EXPECTED_SECTIONS


def test_disclaimer_is_carried_on_the_model() -> None:
    assert full_document().disclaimer == DISCLAIMER


def test_requirement_tables_show_the_source_quote() -> None:
    text = section_text(full_document(), "PKG_03")
    assert "ID" in text and "Priority" in text and "Origin" in text and "Source quote" in text
    assert '"we need a guided onboarding flow" (D1/D1.S1)' in text


def test_statements_carry_requirement_ids_and_a_basis_label() -> None:
    text = section_text(full_document(), "PKG_01")
    assert "[Reqs: FR_01; Basis: Customer]" in text


def test_validation_required_elements_are_flagged() -> None:
    document = full_document()
    assert "Needs validation" in section_text(document, "PKG_06")
    assert "ARC_02" in section_text(document, "PKG_21")


def test_service_names_are_resolved_through_arc_ids() -> None:
    # The data strategy is platform neutral; the service name comes from the architecture.
    text = section_text(full_document(), "PKG_08")
    assert "Cloud services: Customer database (Amazon RDS for PostgreSQL)" in text
    integration_text = section_text(full_document(), "PKG_09")
    assert "Integration gateway (Amazon API Gateway)" in integration_text


def test_provider_options_are_filtered_to_the_selected_platform() -> None:
    text = section_text(full_document(), "PKG_11")
    assert "Amazon Bedrock" in text
    assert "Vertex AI" not in text


def test_rom_section_shows_the_calculation_basis() -> None:
    text = section_text(full_document(), "PKG_14")
    assert "effort x rate x (1 + contingency)" in text
    assert "400,000 to 600,000 USD" in text
    assert "Contingency: 15% applied once" in text


def test_quality_gate_lists_every_pre_export_category() -> None:
    text = section_text(full_document(), "PKG_21")
    for title in (
        "Uncovered requirements",
        "Unresolved questions",
        "Unsupported recommendations",
        "Estimation gaps",
        "Inconsistencies",
        "Items requiring human validation",
    ):
        assert title in text
    assert "NFR_01" in text
    assert "Q_01" in text
    assert "ENH_01" in text
    assert "Expected users" in text
    assert "QG_13" in text


def test_architecture_diagram_section_holds_mermaid_and_a_fallback_table() -> None:
    section = next(s for s in full_document().sections if s.id == "PKG_07")
    kinds = [block.type for block in section.blocks]
    assert BlockType.CODE in kinds and BlockType.IMAGE in kinds and BlockType.TABLE in kinds
    mermaid = next(b for b in section.blocks if b.type is BlockType.CODE)
    assert mermaid.language == "mermaid"


def test_partial_package_builds_with_a_gap_note_per_missing_section() -> None:
    document = empty_document()
    assert len(document.sections) == len(EXPECTED_SECTIONS)
    for section in document.sections:
        assert NOT_GENERATED in section_text(document, section.id), section.id


def test_rejected_scope_items_are_left_out() -> None:
    from app.domain.scope import ItemStatus

    items = fixtures.scope_items()
    items[1].status = ItemStatus.REJECTED
    document = build_package(
        fixtures.session(), items, PackageArtifacts(), None, None, None, fixtures.NOW
    )
    assert fixtures.LONG_TEXT[:40] not in section_text(document, "PKG_03")


def test_unknown_outline_section_is_an_explicit_error() -> None:
    from app.package import builder
    from app.package.errors import OutlineError
    from app.package.outline import OutlineSection

    original = builder.load_outline
    builder.load_outline = lambda: (OutlineSection("PKG_99", "Nonsense", ""),)  # type: ignore[assignment]
    try:
        with pytest.raises(OutlineError):
            empty_document()
    finally:
        builder.load_outline = original  # type: ignore[assignment]


def test_coverage_section_shows_the_matrix_and_uncovered_requirements() -> None:
    text = section_text(full_document(), "PKG_19")
    assert "Coverage matrix" in text
    assert "Capability" in text and "Workstream" in text
    assert "Requirement coverage: 50%" in text
    assert "NFR_01" in text
    assert "recommended enhancement" in text


def test_traceability_links_scope_ids_to_artifact_elements() -> None:
    text = section_text(full_document(), "PKG_20")
    assert "CAP_01" in text
    assert '"we need a guided onboarding flow" (D1/D1.S1)' in text


def test_labels_are_human_readable_everywhere() -> None:
    document = full_document()
    text = "\n".join(section_text(document, section.id) for section in document.sections)
    assert "Customer-stated" in text and "AI-inferred" in text
    assert "customer_stated" not in text
    assert "Amazon Web Services" in document.subtitle
    assert "Mock (recorded responses)" in document.subtitle


def test_no_snake_case_leaks_into_the_rendered_package() -> None:
    from app.package.renderers import render_markdown

    body = render_markdown(full_document(), fixtures.meta()).text
    # Mermaid node ids are source code, not prose, so the fenced blocks are skipped.
    prose, inside_code = [], False
    for line in body.splitlines():
        if line.startswith("```"):
            inside_code = not inside_code
            continue
        if not inside_code:
            prose.append(line)
    leaks = re.findall(r"\b[a-z]+_[a-z]+\b", "\n".join(prose))
    assert leaks == []
