"""DOCX export with python-docx: headings, bullets, real tables and diagram images."""

from collections.abc import Mapping
from io import BytesIO

from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Inches, Pt
from docx.table import Table

from app.domain.package import Block, BlockType, DocumentModel
from app.package.inputs import PackageMeta
from app.package.labels import format_timestamp
from app.package.renderers.base import (
    RenderedDocument,
    column_shares,
    diagram_png,
    package_filename,
)

MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_IMAGE_WIDTH = Inches(6.0)
_TABLE_STYLE = "Table Grid"  # built-in, so borders show in every Word theme
_HEADER_FILL = "D9E2F3"
MERMAID = "mermaid"
_NO_IMAGE_NOTE = (
    "Diagram image not available in this export; the component table below lists the same "
    "information."
)


def _shade(cell: object, fill: str) -> None:
    """Word has no API for cell shading, so the element is added directly."""
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shading)  # type: ignore[attr-defined]


def _set_widths(table: Table, block: Block, usable_width: int) -> None:
    """Word only honours widths set on every cell, not on the column alone."""
    widths = [Emu(int(share * usable_width)) for share in column_shares(block.headers, block.rows)]
    table.autofit = False
    for column, width in zip(table.columns, widths, strict=True):
        column.width = width
    for row in table.rows:
        for cell, width in zip(row.cells, widths, strict=True):
            cell.width = width


def _add_table(document: DocxDocument, block: Block, usable_width: int) -> None:
    if not block.headers:
        return
    table = document.add_table(rows=1, cols=len(block.headers))
    table.style = _TABLE_STYLE
    for cell, header in zip(table.rows[0].cells, block.headers, strict=True):
        cell.text = header
        _shade(cell, _HEADER_FILL)
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True
    for row in block.rows:
        cells = table.add_row().cells
        for index, value in enumerate(row[: len(block.headers)]):
            cells[index].text = value
    _set_widths(table, block, usable_width)


def _add_code(document: DocxDocument, block: Block) -> None:
    paragraph = document.add_paragraph()
    run = paragraph.add_run(block.text)
    run.font.name = "Courier New"
    run.font.size = Pt(8)


def _usable_width(document: DocxDocument) -> int:
    """Text width of the page; falls back to a sensible default on an odd template."""
    page = document.sections[0]
    if page.page_width is None or page.left_margin is None or page.right_margin is None:
        return int(_IMAGE_WIDTH)
    return int(page.page_width - page.left_margin - page.right_margin)


def _add_block(
    document: DocxDocument, block: Block, images: Mapping[str, bytes] | None, usable_width: int
) -> None:
    if block.type is BlockType.HEADING:
        document.add_heading(block.text, level=min(block.level, 5))
    elif block.type is BlockType.PARAGRAPH:
        document.add_paragraph(block.text)
    elif block.type is BlockType.BULLET_LIST:
        for item in block.items:
            document.add_paragraph(item, style="List Bullet")
    elif block.type is BlockType.TABLE:
        _add_table(document, block, usable_width)
    elif block.type is BlockType.CODE:
        # Mermaid source is the Markdown form of a diagram; a document shows the picture.
        if block.language != MERMAID:
            _add_code(document, block)
    elif block.type is BlockType.IMAGE:
        png = diagram_png(block.image_ref, images)
        if png is None:
            document.add_paragraph(_NO_IMAGE_NOTE)
            return
        document.add_picture(BytesIO(png), width=_IMAGE_WIDTH)
        if block.text:
            document.add_paragraph(block.text)


def render_docx(
    document_model: DocumentModel,
    meta: PackageMeta,
    images: Mapping[str, bytes] | None = None,
) -> RenderedDocument:
    document: DocxDocument = Document()
    document.add_heading(document_model.title, level=0)
    if document_model.subtitle:
        document.add_paragraph(document_model.subtitle)
    document.add_paragraph(f"Generated: {format_timestamp(document_model.generated_at)}")
    document.add_paragraph(document_model.disclaimer)
    usable_width = _usable_width(document)
    for section in document_model.sections:
        document.add_heading(section.title, level=1)
        for block in section.blocks:
            _add_block(document, block, images, usable_width)
    document.add_paragraph(document_model.disclaimer)

    buffer = BytesIO()
    document.save(buffer)
    return RenderedDocument(
        filename=package_filename(meta, "docx"),
        content=buffer.getvalue(),
        media_type=MEDIA_TYPE,
    )
