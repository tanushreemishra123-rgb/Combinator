"""Read a source file into raw text blocks. Only text is kept, never the binary."""

import re
from dataclasses import dataclass
from io import BytesIO

from docx import Document as load_docx
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.core.errors import ValidationFailed
from app.domain.scope import DocumentFormat, SegmentKind

_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass(frozen=True)
class RawBlock:
    """One piece of source text plus the structure the format knew about."""

    text: str
    kind: SegmentKind
    page: int | None = None


def _decode(data: bytes, label: str) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationFailed(f"{label} is not valid UTF-8 text.") from exc


def _paragraph_blocks(text: str) -> list[RawBlock]:
    """Blank lines separate paragraphs in plain text."""
    return [
        RawBlock(text=chunk, kind=SegmentKind.PARAGRAPH)
        for chunk in re.split(r"\n\s*\n", text)
        if chunk.strip()
    ]


def extract_txt(data: bytes) -> list[RawBlock]:
    return _paragraph_blocks(_decode(data, "The text file"))


def extract_md(data: bytes) -> list[RawBlock]:
    blocks: list[RawBlock] = []
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            blocks.append(RawBlock(text="\n".join(buffer), kind=SegmentKind.PARAGRAPH))
            buffer.clear()

    for line in _decode(data, "The markdown file").splitlines():
        heading = _HEADING.match(line.strip())
        if heading:
            flush()
            blocks.append(RawBlock(text=heading.group(2), kind=SegmentKind.HEADING))
        elif line.strip():
            buffer.append(line)
        else:
            flush()
    flush()
    return blocks


def extract_pdf(data: bytes) -> list[RawBlock]:
    """One block per page: a PDF page is the finest structure pypdf reports reliably."""
    try:
        reader = PdfReader(BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
    except (PyPdfError, ValueError, OSError) as exc:
        raise ValidationFailed("The PDF could not be read.") from exc
    return [
        RawBlock(text=text, kind=SegmentKind.PAGE, page=number)
        for number, text in enumerate(pages, start=1)
        if text.strip()
    ]


def extract_docx(data: bytes) -> list[RawBlock]:
    try:
        document = load_docx(BytesIO(data))
    except (ValueError, KeyError, OSError) as exc:
        raise ValidationFailed("The DOCX file could not be read.") from exc
    blocks = [
        RawBlock(text=paragraph.text, kind=_paragraph_kind(_style_name(paragraph.style)))
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    ]
    # Requirement tables are common in DOCX input; keep their text as rows.
    blocks += [
        RawBlock(text=row_text, kind=SegmentKind.PARAGRAPH)
        for table in document.tables
        for row in table.rows
        if (row_text := " | ".join(cell.text.strip() for cell in row.cells)).strip(" |")
    ]
    return blocks


def _style_name(style: object) -> str | None:
    name = getattr(style, "name", None)
    return name if isinstance(name, str) else None


def _paragraph_kind(style_name: str | None) -> SegmentKind:
    if style_name and style_name.startswith(("Heading", "Title", "Subtitle")):
        return SegmentKind.HEADING
    return SegmentKind.PARAGRAPH


_EXTRACTORS = {
    DocumentFormat.TXT: extract_txt,
    DocumentFormat.MD: extract_md,
    DocumentFormat.PDF: extract_pdf,
    DocumentFormat.DOCX: extract_docx,
}


def extract(document_format: DocumentFormat, data: bytes) -> list[RawBlock]:
    """Raw blocks for a supported format; raises ValidationFailed on unreadable input."""
    if not data:
        raise ValidationFailed("The file is empty.")
    return _EXTRACTORS[document_format](data)
