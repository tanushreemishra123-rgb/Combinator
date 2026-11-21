"""Segments must address the normalized text exactly."""

from app.domain.scope import DocumentFormat, SegmentKind
from app.ingestion.extractors import extract
from app.ingestion.normalizer import normalize

MARKDOWN = b"""# Portal

The   customer   wants\ta portal.
Second line of the same paragraph.

## Volumes

About 5,000 users.
"""


def test_offsets_address_the_normalized_text() -> None:
    document = normalize(extract(DocumentFormat.MD, MARKDOWN), 1)
    assert document.segments
    for segment in document.segments:
        assert document.normalized_text[segment.start : segment.end] == segment.text


def test_segment_ids_and_indexes_are_sequential() -> None:
    document = normalize(extract(DocumentFormat.MD, MARKDOWN), 2)
    assert [segment.segment_id for segment in document.segments][:3] == [
        "D2.S1",
        "D2.S2",
        "D2.S3",
    ]
    assert [segment.index for segment in document.segments] == list(range(len(document.segments)))


def test_whitespace_is_collapsed_and_headings_carry_down() -> None:
    document = normalize(extract(DocumentFormat.MD, MARKDOWN), 1)
    body = document.segments[1]
    assert body.kind is SegmentKind.PARAGRAPH
    assert body.text == "The customer wants a portal. Second line of the same paragraph."
    assert body.heading == "Portal"
    assert document.segments[-1].heading == "Volumes"


def test_pages_are_kept_on_segments() -> None:
    from io import BytesIO

    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    for text in ("Alpha page", "Beta page"):
        pdf.drawString(72, 720, text)
        pdf.showPage()
    pdf.save()
    document = normalize(extract(DocumentFormat.PDF, buffer.getvalue()), 1)
    assert [segment.page for segment in document.segments] == [1, 2]
    for segment in document.segments:
        assert document.normalized_text[segment.start : segment.end] == segment.text


def test_blank_input_produces_nothing() -> None:
    document = normalize([], 1)
    assert document.normalized_text == ""
    assert document.segments == []
