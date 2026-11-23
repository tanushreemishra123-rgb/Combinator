"""Shared renderer helpers: file naming and PNG validation."""

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.package.errors import InvalidDiagramImage
from app.package.inputs import PackageMeta

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # a page-sized diagram never needs more
MIN_IMAGE_BYTES = len(PNG_MAGIC) + 16

_NON_SLUG = re.compile(r"[^a-z0-9]+")

# Column sizing: an ID column never needs the same width as a source quote.
_CHAR_SHARE = 0.012  # rough share of the page width one character takes at table font size
_CELL_PADDING_CHARS = 2
_MAX_CHARS = 80


def _longest_word(text: str) -> int:
    return max((len(word) for word in text.split()), default=0)


def column_shares(headers: Sequence[str], rows: Sequence[Sequence[str]]) -> list[float]:
    """Width share per column, summing to 1.

    Each column first gets room for its longest word, so ids and labels never break
    mid-word. The rest of the width goes to the columns with the longest text.
    """
    if not headers:
        return []
    floors: list[float] = []
    wants: list[float] = []
    for index, header in enumerate(headers):
        cells = [header, *(row[index] for row in rows if index < len(row))]
        word = max(_longest_word(cell) for cell in cells)
        longest = min(max(len(cell) for cell in cells), _MAX_CHARS)
        floors.append((word + _CELL_PADDING_CHARS) * _CHAR_SHARE)
        wants.append(float(max(longest - word, 0)))
    reserved = sum(floors)
    if reserved >= 1:
        return [floor / reserved for floor in floors]
    spare = 1 - reserved
    total_want = sum(wants)
    if total_want == 0:
        return [floor + spare / len(floors) for floor in floors]
    return [floor + spare * want / total_want for floor, want in zip(floors, wants, strict=True)]


@dataclass(frozen=True)
class RenderedDocument:
    """A rendered export: what to send and what to call it."""

    filename: str
    content: bytes
    media_type: str

    @property
    def text(self) -> str:
        """The rendered content as text; only meaningful for the Markdown export."""
        return self.content.decode("utf-8")


def slugify(value: str, fallback: str = "customer") -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = _NON_SLUG.sub("-", ascii_value.lower()).strip("-")[:60].strip("-")
    return slug or fallback


def package_filename(meta: PackageMeta, extension: str) -> str:
    return f"scoping-package-{slugify(meta.customer_name)}-v{meta.scope_version}.{extension}"


def validate_png(data: bytes) -> bytes:
    """Reject anything that is not a plausibly sized PNG before it reaches a renderer."""
    if not isinstance(data, bytes | bytearray):
        raise InvalidDiagramImage("diagram image must be raw bytes")
    if len(data) < MIN_IMAGE_BYTES:
        raise InvalidDiagramImage("diagram image is too small to be a PNG")
    if len(data) > MAX_IMAGE_BYTES:
        raise InvalidDiagramImage(f"diagram image is larger than the {MAX_IMAGE_BYTES} byte limit")
    if not data.startswith(PNG_MAGIC):
        raise InvalidDiagramImage("diagram image is not a PNG")
    return bytes(data)


def diagram_png(image_ref: str, images: Mapping[str, bytes] | None) -> bytes | None:
    """Validated PNG for a diagram id, or None when the caller supplied none."""
    if not images:
        return None
    data = images.get(image_ref)
    if data is None:
        return None
    return validate_png(data)
