"""Renderer-neutral document model for the scoping package (PLAN section 9)."""

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.domain.base import DomainModel

# Exact statement required in every exported package (challenge, "Integrated Scoping Package").
DISCLAIMER = (
    "This document is an AI-assisted internal planning output based on customer requirements "
    "and stated assumptions. It requires review and validation by qualified sales, architecture, "
    "delivery, security, and commercial stakeholders. It is not a final quote, contractual "
    "commitment, or delivery guarantee."
)


class BlockType(StrEnum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    BULLET_LIST = "bullet_list"
    TABLE = "table"
    IMAGE = "image"
    CODE = "code"


class Block(DomainModel):
    """One renderable block; only the fields matching `type` are filled."""

    type: BlockType = Field(description="Block kind.")
    text: str = Field(default="", description="Text for heading, paragraph, image caption or code.")
    level: int = Field(default=2, ge=1, le=6, description="Heading level.")
    items: list[str] = Field(default_factory=list, description="Entries of a bullet list.")
    headers: list[str] = Field(default_factory=list, description="Table header cells.")
    rows: list[list[str]] = Field(default_factory=list, description="Table body rows.")
    image_ref: str = Field(default="", description="Image key or data URL for image blocks.")
    language: str = Field(default="", description="Language of a code block, e.g. mermaid.")


class Section(DomainModel):
    id: str = Field(description="Stable section id, e.g. executive_summary.")
    title: str = Field(description="Section title as printed.")
    blocks: list[Block] = Field(default_factory=list, description="Blocks in document order.")


class DocumentModel(DomainModel):
    title: str = Field(description="Document title.")
    subtitle: str = Field(default="", description="Customer and session subtitle.")
    generated_at: datetime = Field(description="When the package was built.")
    disclaimer: str = Field(
        default=DISCLAIMER, description="Mandatory statement printed at the top and bottom."
    )
    sections: list[Section] = Field(default_factory=list, description="Sections in spec order.")
