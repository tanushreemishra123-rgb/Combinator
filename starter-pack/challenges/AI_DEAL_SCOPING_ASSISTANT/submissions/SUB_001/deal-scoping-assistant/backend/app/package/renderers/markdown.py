"""Markdown export: Mermaid code blocks and GitHub tables."""

from app.domain.package import Block, BlockType, DocumentModel
from app.package.inputs import PackageMeta
from app.package.labels import format_timestamp
from app.package.renderers.base import RenderedDocument, package_filename

MEDIA_TYPE = "text/markdown; charset=utf-8"


def _cell(value: str) -> str:
    """Pipes and newlines would break a GitHub table row."""
    return value.replace("|", "\\|").replace("\n", " ").strip() or " "


def _render_block(block: Block) -> str:
    if block.type is BlockType.HEADING:
        return f"{'#' * block.level} {block.text}"
    if block.type is BlockType.PARAGRAPH:
        return block.text
    if block.type is BlockType.BULLET_LIST:
        return "\n".join(f"- {item}" for item in block.items)
    if block.type is BlockType.TABLE:
        if not block.headers:
            return ""
        header = "| " + " | ".join(_cell(h) for h in block.headers) + " |"
        divider = "| " + " | ".join("---" for _ in block.headers) + " |"
        rows = ["| " + " | ".join(_cell(c) for c in row) + " |" for row in block.rows]
        return "\n".join([header, divider, *rows])
    if block.type is BlockType.CODE:
        return f"```{block.language}\n{block.text}\n```"
    if block.type is BlockType.IMAGE:
        # The Mermaid source above the image block is the Markdown representation.
        return f"*{block.text}*" if block.text else ""
    return ""


def render_markdown(document: DocumentModel, meta: PackageMeta) -> RenderedDocument:
    parts = [
        f"# {document.title}",
        document.subtitle,
        f"Generated: {format_timestamp(document.generated_at)}",
        f"> {document.disclaimer}",
    ]
    for section in document.sections:
        parts.append(f"## {section.title}")
        parts += [rendered for block in section.blocks if (rendered := _render_block(block))]
    parts.append(f"> {document.disclaimer}")
    text = "\n\n".join(part for part in parts if part).strip() + "\n"
    return RenderedDocument(
        filename=package_filename(meta, "md"),
        content=text.encode("utf-8"),
        media_type=MEDIA_TYPE,
    )
