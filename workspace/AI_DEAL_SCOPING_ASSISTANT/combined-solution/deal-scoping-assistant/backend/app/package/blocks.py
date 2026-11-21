"""Small constructors for `DocumentModel` blocks, so section builders stay readable."""

from app.domain.package import Block, BlockType

NOT_GENERATED = "Not generated yet."


def heading(text: str, level: int = 3) -> Block:
    return Block(type=BlockType.HEADING, text=text, level=level)


def paragraph(text: str) -> Block:
    return Block(type=BlockType.PARAGRAPH, text=text)


def bullets(items: list[str]) -> Block:
    return Block(type=BlockType.BULLET_LIST, items=items)


def table(headers: list[str], rows: list[list[str]]) -> Block:
    return Block(type=BlockType.TABLE, headers=headers, rows=rows)


def code(text: str, language: str = "") -> Block:
    return Block(type=BlockType.CODE, text=text, language=language)


def image(image_ref: str, caption: str) -> Block:
    return Block(type=BlockType.IMAGE, image_ref=image_ref, text=caption)


def missing(what: str) -> Block:
    """Placeholder so a partial package still exports with a clear gap marker."""
    return paragraph(f"{NOT_GENERATED} {what}")
