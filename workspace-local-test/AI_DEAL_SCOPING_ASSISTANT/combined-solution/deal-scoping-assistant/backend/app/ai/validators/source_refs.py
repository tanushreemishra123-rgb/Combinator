"""Quotes must match the referenced segment text exactly after whitespace normalization."""

import re
from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, warning
from app.ai.validators.common import item_key
from app.domain.scope import Segment, SourceDocument, SourceRef

_WHITESPACE = re.compile(r"\s+")


def _normalize(text: str) -> tuple[str, list[int]]:
    """Collapse whitespace and keep, for every kept character, its index in `text`."""
    out: list[str] = []
    positions: list[int] = []
    previous_space = True  # leading whitespace is dropped
    for index, char in enumerate(text):
        if _WHITESPACE.match(char):
            if not previous_space:
                out.append(" ")
                positions.append(index)
            previous_space = True
            continue
        out.append(char)
        positions.append(index)
        previous_space = False
    while out and out[-1] == " ":
        out.pop()
        positions.pop()
    return "".join(out), positions


def verify_source_ref(ref: SourceRef, segment: Segment) -> bool:
    """Mark the ref verified and fill document offsets when the quote is found."""
    normalized_segment, positions = _normalize(segment.text)
    normalized_quote, _ = _normalize(ref.quote)
    if not normalized_quote:
        ref.verified = False
        return False
    found = normalized_segment.find(normalized_quote)
    if found < 0:
        ref.verified = False
        return False
    ref.start = segment.start + positions[found]
    ref.end = segment.start + positions[found + len(normalized_quote) - 1] + 1
    ref.verified = True
    return True


def check_source_refs(items: Sequence[Any], documents: Sequence[SourceDocument]) -> list[Finding]:
    """Verify every quote against its segment; unverified refs are kept and reported."""
    segments: dict[tuple[str, str], Segment] = {
        (document.id, segment.segment_id): segment
        for document in documents
        for segment in document.segments
    }
    findings: list[Finding] = []
    for item in items:
        key = item_key(item)
        for ref in item.source_refs:
            segment = segments.get((ref.document_id, ref.segment_id))
            if segment is None:
                ref.verified = False
                findings.append(
                    warning(
                        f"{key}: segment {ref.segment_id} does not exist in document "
                        f"{ref.document_id}",
                        [key],
                    )
                )
                continue
            if not verify_source_ref(ref, segment):
                findings.append(
                    warning(
                        f"{key}: quote was not found in segment {ref.segment_id}; "
                        "quote the customer text exactly",
                        [key],
                    )
                )
    return findings
