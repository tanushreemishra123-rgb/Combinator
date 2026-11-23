"""PDF export with ReportLab platypus: wrapped table cells, split tables, page numbers."""

from collections.abc import Mapping
from io import BytesIO
from typing import Any

from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_LEFT  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import-untyped]
from reportlab.lib.units import mm  # type: ignore[import-untyped]
from reportlab.lib.utils import ImageReader  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    Image,
    ListFlowable,
    ListItem,
    LongTable,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)

from app.domain.package import Block, BlockType, DocumentModel
from app.package.inputs import PackageMeta
from app.package.labels import format_timestamp
from app.package.renderers.base import (
    RenderedDocument,
    column_shares,
    diagram_png,
    package_filename,
)

MEDIA_TYPE = "application/pdf"
_MARGIN = 15 * mm
_CONTENT_WIDTH = A4[0] - 2 * _MARGIN
MERMAID = "mermaid"
_NO_IMAGE_NOTE = (
    "Diagram image not available in this export; the component table below lists the same "
    "information."
)

_STYLES = getSampleStyleSheet()
_BODY = _STYLES["BodyText"]
_CELL = ParagraphStyle(
    "PackageCell",
    parent=_BODY,
    fontSize=7,
    leading=8.5,
    spaceBefore=0,
    spaceAfter=0,
    alignment=TA_LEFT,
)
_CELL_HEADER = ParagraphStyle("PackageCellHeader", parent=_CELL, fontName="Helvetica-Bold")
_CODE = ParagraphStyle("PackageCode", parent=_STYLES["Code"], fontSize=7, leading=8.5)
# Headings breathe above and never end a page on their own.
_HEADINGS = {
    level: ParagraphStyle(
        f"PackageHeading{level}",
        parent=_STYLES[f"Heading{level}"],
        spaceBefore=20 - 3 * level,
        spaceAfter=5,
        keepWithNext=1,
    )
    for level in (1, 2, 3, 4)
}

_TABLE_STYLE = TableStyle(
    [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9aa4b2")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8ecf1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
)


def _escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_escape(text) or "&nbsp;", style)


def _table(block: Block) -> list[Any]:
    if not block.headers:
        return []
    columns = len(block.headers)
    data = [[_para(header, _CELL_HEADER) for header in block.headers]]
    for row in block.rows:
        padded = list(row[:columns]) + [""] * (columns - len(row))
        data.append([_para(cell, _CELL) for cell in padded])
    # Columns are sized from their content so ids stay narrow and prose gets the room.
    widths = [share * _CONTENT_WIDTH for share in column_shares(block.headers, block.rows)]
    # LongTable splits over pages; repeatRows keeps the header, splitInRow avoids blank pages.
    table = LongTable(
        data, colWidths=widths, repeatRows=1, splitByRow=1, splitInRow=1, spaceBefore=4
    )
    table.setStyle(_TABLE_STYLE)
    return [table, Spacer(1, 6)]


def _image(block: Block, images: Mapping[str, bytes] | None) -> list[Any]:
    png = diagram_png(block.image_ref, images)
    if png is None:
        return [_para(_NO_IMAGE_NOTE, _BODY)]
    reader = ImageReader(BytesIO(png))
    source_width, source_height = reader.getSize()
    width = min(float(_CONTENT_WIDTH), float(source_width))
    height = width * float(source_height) / float(source_width)
    flowables: list[Any] = [Image(BytesIO(png), width=width, height=height)]
    if block.text:
        flowables.append(_para(block.text, _BODY))
    return flowables


def _flowables(block: Block, images: Mapping[str, bytes] | None) -> list[Any]:
    if block.type is BlockType.HEADING:
        return [_para(block.text, _HEADINGS[min(block.level, 4)])]
    if block.type is BlockType.PARAGRAPH:
        return [_para(block.text, _BODY)]
    if block.type is BlockType.BULLET_LIST:
        if not block.items:
            return []
        return [
            ListFlowable(
                [ListItem(_para(item, _BODY)) for item in block.items],
                bulletType="bullet",
                start="circle",
                leftIndent=12,
            ),
            Spacer(1, 6),
        ]
    if block.type is BlockType.TABLE:
        return _table(block)
    if block.type is BlockType.CODE:
        # Mermaid source is the Markdown form of a diagram; a document shows the picture.
        if block.language == MERMAID:
            return []
        return [Preformatted(block.text, _CODE), Spacer(1, 6)]
    if block.type is BlockType.IMAGE:
        return _image(block, images)
    return []


def _page_number(canvas: Any, document: Any) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(A4[0] / 2, _MARGIN / 2, f"Page {document.page}")
    canvas.restoreState()


def render_pdf(
    document_model: DocumentModel,
    meta: PackageMeta,
    images: Mapping[str, bytes] | None = None,
) -> RenderedDocument:
    story: list[Any] = [
        _para(document_model.title, _STYLES["Title"]),
        _para(document_model.subtitle, _BODY),
        _para(f"Generated: {format_timestamp(document_model.generated_at)}", _BODY),
        _para(document_model.disclaimer, _BODY),
        Spacer(1, 10),
    ]
    for section in document_model.sections:
        story.append(_para(section.title, _HEADINGS[1]))
        for block in section.blocks:
            story.extend(_flowables(block, images))
    story.append(Spacer(1, 12))
    story.append(_para(document_model.disclaimer, _BODY))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=_MARGIN,
        rightMargin=_MARGIN,
        topMargin=_MARGIN,
        bottomMargin=_MARGIN,
        title=document_model.title,
    )
    doc.build(story, onFirstPage=_page_number, onLaterPages=_page_number)
    return RenderedDocument(
        filename=package_filename(meta, "pdf"),
        content=buffer.getvalue(),
        media_type=MEDIA_TYPE,
    )
