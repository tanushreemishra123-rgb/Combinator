"""Markdown, DOCX and PDF exports: disclaimer, tables, images and file names."""

import re
from io import BytesIO

import pytest
from docx import Document as read_docx
from pypdf import PdfReader

from app.domain.package import DISCLAIMER
from app.package.errors import InvalidDiagramImage
from app.package.inputs import PackageMeta
from app.package.renderers import render_docx, render_markdown, render_pdf
from app.package.renderers.base import (
    MAX_IMAGE_BYTES,
    column_shares,
    package_filename,
    slugify,
    validate_png,
)
from tests.unit.package import fixtures
from tests.unit.package.test_builder import full_document

IMAGES = {
    "architecture_diagram": fixtures.png_bytes(),
    "integration_diagram": fixtures.png_bytes(),
}


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


# --- Markdown ----------------------------------------------------------------


def test_markdown_contains_the_disclaimer_at_top_and_bottom() -> None:
    rendered = render_markdown(full_document(), fixtures.meta())
    assert rendered.text.count(DISCLAIMER) == 2
    body = rendered.text
    assert body.index(DISCLAIMER) < body.index("## Executive summary")
    assert body.rindex(DISCLAIMER) > body.rindex("## Quality gate results")


def test_markdown_uses_mermaid_code_blocks_and_github_tables() -> None:
    body = render_markdown(full_document(), fixtures.meta()).text
    assert "```mermaid\nflowchart LR" in body
    assert "| ID | Type | Priority | Origin | Description | Source quote |" in body
    assert "| --- |" in body


def test_markdown_escapes_pipes_inside_cells() -> None:
    body = render_markdown(full_document(), fixtures.meta()).text
    row = next(line for line in body.splitlines() if line.startswith("| ARC_01 |"))
    assert "\\|" in row
    assert row.count("|") - row.count("\\|") == 7  # six cells, seven delimiters


def test_long_cell_text_survives_in_markdown() -> None:
    body = render_markdown(full_document(), fixtures.meta()).text
    assert normalise(fixtures.LONG_TEXT) in normalise(body)


# --- DOCX --------------------------------------------------------------------


def test_docx_contains_the_disclaimer_twice_and_real_tables() -> None:
    rendered = render_docx(full_document(), fixtures.meta(), IMAGES)
    document = read_docx(BytesIO(rendered.content))
    paragraphs = [p.text for p in document.paragraphs]
    assert paragraphs.count(DISCLAIMER) == 2
    assert paragraphs[-1] == DISCLAIMER
    assert document.tables
    header = [cell.text for cell in document.tables[0].rows[0].cells]
    assert header and all(text.strip() for text in header)


def test_docx_keeps_long_cell_text() -> None:
    rendered = render_docx(full_document(), fixtures.meta(), IMAGES)
    document = read_docx(BytesIO(rendered.content))
    cells = [cell.text for table in document.tables for row in table.rows for cell in row.cells]
    assert any(normalise(fixtures.LONG_TEXT) == normalise(cell) for cell in cells)


def test_docx_embeds_the_diagram_images() -> None:
    with_images = render_docx(full_document(), fixtures.meta(), IMAGES)
    without = render_docx(full_document(), fixtures.meta(), None)
    assert len(with_images.content) > len(without.content)
    document = read_docx(BytesIO(without.content))
    assert any("Diagram image not available" in p.text for p in document.paragraphs)


def test_docx_shows_the_diagram_once_not_its_mermaid_source() -> None:
    document = read_docx(BytesIO(render_docx(full_document(), fixtures.meta(), IMAGES).content))
    text = " ".join(p.text for p in document.paragraphs)
    assert "flowchart LR" not in text
    assert len(document.inline_shapes) == 2


# --- PDF ---------------------------------------------------------------------


def pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    # PDF wraps lines, so compare on whitespace-normalised text.
    return normalise(" ".join(page.extract_text() or "" for page in reader.pages))


def test_pdf_contains_the_disclaimer_at_top_and_bottom() -> None:
    rendered = render_pdf(full_document(), fixtures.meta(), IMAGES)
    text = pdf_text(rendered.content)
    assert text.count(normalise(DISCLAIMER)) == 2


def test_pdf_splits_long_tables_over_several_pages() -> None:
    rendered = render_pdf(full_document(), fixtures.meta(), IMAGES)
    reader = PdfReader(BytesIO(rendered.content))
    assert len(reader.pages) > 2
    assert "Page 2" in normalise(reader.pages[1].extract_text() or "")


def test_pdf_keeps_long_cell_text() -> None:
    text = pdf_text(render_pdf(full_document(), fixtures.meta(), IMAGES).content)
    assert normalise(fixtures.LONG_TEXT) in text


def test_pdf_shows_the_diagram_once_not_its_mermaid_source() -> None:
    text = pdf_text(render_pdf(full_document(), fixtures.meta(), IMAGES).content)
    assert "flowchart LR" not in text
    assert "Figure 1" in text


def test_pdf_falls_back_to_a_note_when_no_image_is_supplied() -> None:
    text = pdf_text(render_pdf(full_document(), fixtures.meta(), None).content)
    assert "Diagram image not available" in text
    assert "Components shown in the diagram" in text


# --- images and names --------------------------------------------------------


@pytest.mark.parametrize(
    "data",
    [b"", b"not a png at all, really not", b"\x89PNG" + b"\x00" * 40],
)
def test_invalid_png_is_rejected(data: bytes) -> None:
    with pytest.raises(InvalidDiagramImage):
        validate_png(data)


def test_oversized_png_is_rejected() -> None:
    with pytest.raises(InvalidDiagramImage):
        validate_png(fixtures.png_bytes() + b"\x00" * MAX_IMAGE_BYTES)


def test_renderers_reject_an_invalid_image() -> None:
    bad = {"architecture_diagram": b"<svg>not a png</svg>"}
    with pytest.raises(InvalidDiagramImage):
        render_docx(full_document(), fixtures.meta(), bad)
    with pytest.raises(InvalidDiagramImage):
        render_pdf(full_document(), fixtures.meta(), bad)


def test_filename_is_slugged_per_renderer() -> None:
    meta = fixtures.meta()
    assert (
        render_markdown(full_document(), meta).filename == "scoping-package-acme-corp-nordics-v3.md"
    )
    assert render_docx(full_document(), meta, IMAGES).filename.endswith(".docx")
    assert render_pdf(full_document(), meta, IMAGES).filename.endswith(".pdf")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Acme Corp / Nordics", "acme-corp-nordics"),
        ("  ../../etc/passwd  ", "etc-passwd"),
        ("Ünïcode Ätd.", "unicode-atd"),
        ("!!!", "customer"),
        ("", "customer"),
    ],
)
def test_slugify(raw: str, expected: str) -> None:
    assert slugify(raw) == expected


def test_package_filename_uses_the_scope_version() -> None:
    meta = PackageMeta(customer_name="Globex", scope_version=12)
    assert package_filename(meta, "md") == "scoping-package-globex-v12.md"


# --- layout ------------------------------------------------------------------


def test_column_shares_follow_content_length() -> None:
    shares = column_shares(
        ["ID", "Type", "Priority", "Description"],
        [["FR_01", "FR", "High", "x" * 300]],
    )
    assert pytest.approx(sum(shares)) == 1.0
    assert shares[3] > shares[0] > 0
    assert shares[0] == pytest.approx(shares[1], abs=0.02)


def test_column_shares_handle_an_empty_table() -> None:
    assert column_shares([], []) == []


def test_timestamp_is_human_readable_in_every_format() -> None:
    stamp = "17 Sep 2026, 10:00 UTC"
    assert f"Generated: {stamp}" in render_markdown(full_document(), fixtures.meta()).text
    docx_document = read_docx(BytesIO(render_docx(full_document(), fixtures.meta()).content))
    docx_paragraphs = [p.text for p in docx_document.paragraphs]
    assert f"Generated: {stamp}" in docx_paragraphs
    assert stamp in pdf_text(render_pdf(full_document(), fixtures.meta(), IMAGES).content)


def test_pdf_starts_the_executive_summary_on_page_one() -> None:
    reader = PdfReader(BytesIO(render_pdf(full_document(), fixtures.meta(), IMAGES).content))
    first_page = normalise(reader.pages[0].extract_text() or "")
    assert "Executive summary" in first_page
    assert DISCLAIMER.split(".")[0] in first_page  # the cover block is on page 1 too


def test_pdf_tables_are_sized_from_their_content() -> None:
    rendered = render_pdf(full_document(), fixtures.meta(), IMAGES)
    assert rendered.content.startswith(b"%PDF")
    text = pdf_text(rendered.content)
    # A squeezed source-quote column would break the quote across many short lines.
    assert "we need a guided onboarding flow" in text


def test_docx_tables_use_a_bordered_style_with_a_shaded_header() -> None:
    document = read_docx(BytesIO(render_docx(full_document(), fixtures.meta(), IMAGES).content))
    table = document.tables[0]
    assert table.style is not None and table.style.name == "Table Grid"
    assert table.autofit is False
    header_xml = table.rows[0].cells[0]._tc.xml
    assert 'w:fill="D9E2F3"' in header_xml
    widths = [cell.width for cell in table.rows[0].cells]
    assert all(width is not None for width in widths)
    assert len(set(widths)) > 1  # not every column is the same width
