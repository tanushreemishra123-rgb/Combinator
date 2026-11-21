"""Each supported format produces raw blocks; unreadable input is rejected."""

from io import BytesIO

import pytest
from docx import Document as DocxDocument
from reportlab.pdfgen import canvas

from app.core.errors import ValidationFailed
from app.domain.scope import DocumentFormat, SegmentKind
from app.ingestion.extractors import extract


def _pdf_bytes(pages: list[str]) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    for text in pages:
        pdf.drawString(72, 720, text)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _docx_bytes() -> bytes:
    document = DocxDocument()
    document.add_heading("Scope", level=1)
    document.add_paragraph("The portal must support single sign-on.")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Users"
    table.rows[0].cells[1].text = "5000"
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_txt_splits_on_blank_lines() -> None:
    blocks = extract(DocumentFormat.TXT, b"First para.\nStill first.\n\nSecond para.\n")
    assert [block.kind for block in blocks] == [SegmentKind.PARAGRAPH] * 2
    assert "Still first." in blocks[0].text
    assert blocks[1].text.strip() == "Second para."


def test_md_marks_headings_and_keeps_body() -> None:
    blocks = extract(DocumentFormat.MD, b"# Title\n\nBody line one.\nBody line two.\n\n## Sub\n")
    kinds = [block.kind for block in blocks]
    assert kinds == [SegmentKind.HEADING, SegmentKind.PARAGRAPH, SegmentKind.HEADING]
    assert blocks[0].text == "Title"
    assert blocks[2].text == "Sub"


def test_pdf_yields_one_block_per_page() -> None:
    blocks = extract(DocumentFormat.PDF, _pdf_bytes(["Page one text", "Page two text"]))
    assert [block.page for block in blocks] == [1, 2]
    assert all(block.kind is SegmentKind.PAGE for block in blocks)
    assert "Page two text" in blocks[1].text


def test_docx_reads_headings_paragraphs_and_tables() -> None:
    blocks = extract(DocumentFormat.DOCX, _docx_bytes())
    assert blocks[0].kind is SegmentKind.HEADING
    assert blocks[0].text == "Scope"
    assert "single sign-on" in blocks[1].text
    assert any("Users | 5000" in block.text for block in blocks)


def test_empty_file_is_rejected() -> None:
    with pytest.raises(ValidationFailed, match="empty"):
        extract(DocumentFormat.TXT, b"")


def test_unreadable_pdf_is_rejected() -> None:
    with pytest.raises(ValidationFailed, match="PDF"):
        extract(DocumentFormat.PDF, b"not a pdf at all")


def test_non_utf8_text_is_rejected() -> None:
    with pytest.raises(ValidationFailed, match="UTF-8"):
        extract(DocumentFormat.TXT, b"\xff\xfe\x00bad")
