"""Turn raw blocks into one normalized text plus addressable segments."""

import re
from dataclasses import dataclass

from app.domain.scope import Segment, SegmentKind
from app.ingestion.extractors import RawBlock

SEPARATOR = "\n\n"
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class NormalizedDocument:
    normalized_text: str
    segments: list[Segment]


def clean(text: str) -> str:
    """Collapse every whitespace run to a single space so quotes can be matched exactly."""
    return _WHITESPACE.sub(" ", text).strip()


def normalize(blocks: list[RawBlock], document_index: int) -> NormalizedDocument:
    """Build the text so that `normalized_text[s.start : s.end] == s.text` for every segment."""
    texts: list[str] = []
    segments: list[Segment] = []
    cursor = 0
    heading = ""
    for block in blocks:
        text = clean(block.text)
        if not text:
            continue
        if segments:
            cursor += len(SEPARATOR)
        if block.kind is SegmentKind.HEADING:
            heading = text
        index = len(segments)
        segments.append(
            Segment(
                segment_id=f"D{document_index}.S{index + 1}",
                kind=block.kind,
                index=index,
                page=block.page,
                heading=heading,
                text=text,
                start=cursor,
                end=cursor + len(text),
            )
        )
        texts.append(text)
        cursor += len(text)
    return NormalizedDocument(normalized_text=SEPARATOR.join(texts), segments=segments)
