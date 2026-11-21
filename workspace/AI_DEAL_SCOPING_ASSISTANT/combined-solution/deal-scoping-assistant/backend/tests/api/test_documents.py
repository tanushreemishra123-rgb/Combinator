"""Document endpoints: paste, upload, list, read, delete."""

from collections.abc import Iterator
from io import BytesIO

import pytest
from docx import Document as DocxDocument
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.main import app

BASE = "/api/v1/sessions"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def session_id(client: TestClient) -> str:
    return str(client.post(BASE, json={"name": "Documents"}).json()["id"])


def _pdf() -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(72, 720, "Vekter runs 47 batch jobs.")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _docx() -> bytes:
    document = DocxDocument()
    document.add_heading("Requirements", level=1)
    document.add_paragraph("Self-service portal for policyholders.")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_paste_text_as_json(client: TestClient, session_id: str) -> None:
    response = client.post(
        f"{BASE}/{session_id}/documents",
        json={"name": "email.md", "text": "# Enquiry\n\nWe want a portal."},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["kind"] == "pasted"
    assert body["format"] == "md"
    assert body["segments"][0]["segment_id"] == "D1.S1"
    assert (
        body["normalized_text"][body["segments"][1]["start"] : body["segments"][1]["end"]]
        == body["segments"][1]["text"]
    )


def test_upload_pdf_and_docx(client: TestClient, session_id: str) -> None:
    pdf = client.post(
        f"{BASE}/{session_id}/documents",
        files={"file": ("rfp.pdf", _pdf(), "application/pdf")},
    )
    assert pdf.status_code == 201, pdf.text
    assert pdf.json()["format"] == "pdf"
    assert pdf.json()["segments"][0]["page"] == 1

    docx = client.post(
        f"{BASE}/{session_id}/documents",
        files={"file": ("brief.docx", _docx(), "application/octet-stream")},
    )
    assert docx.status_code == 201, docx.text
    assert "policyholders" in docx.json()["normalized_text"]


def test_unsupported_upload_is_rejected(client: TestClient, session_id: str) -> None:
    response = client.post(
        f"{BASE}/{session_id}/documents",
        files={"file": ("photo.png", b"\x89PNG", "image/png")},
    )
    assert response.status_code == 422
    assert "not supported" in response.json()["detail"]


def test_body_without_file_or_text_is_rejected(client: TestClient, session_id: str) -> None:
    assert client.post(f"{BASE}/{session_id}/documents", json={"name": "x"}).status_code == 422
    assert client.post(f"{BASE}/{session_id}/documents", content=b"nope").status_code == 422


def test_list_read_and_delete(client: TestClient, session_id: str) -> None:
    created = client.post(
        f"{BASE}/{session_id}/documents", json={"name": "email.md", "text": "A portal."}
    ).json()
    listing = client.get(f"{BASE}/{session_id}/documents")
    assert listing.status_code == 200
    assert listing.json() == [
        {
            "id": created["id"],
            "session_id": session_id,
            "name": "email.md",
            "kind": "pasted",
            "format": "md",
            "char_count": len("A portal."),
            "segment_count": 1,
            "created_at": created["created_at"],
        }
    ]
    fetched = client.get(f"{BASE}/{session_id}/documents/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["segments"][0]["text"] == "A portal."
    assert client.delete(f"{BASE}/{session_id}/documents/{created['id']}").status_code == 204
    assert client.get(f"{BASE}/{session_id}/documents/{created['id']}").status_code == 404


def test_document_of_another_session_is_not_found(client: TestClient, session_id: str) -> None:
    other = client.post(BASE, json={"name": "Other"}).json()["id"]
    created = client.post(
        f"{BASE}/{session_id}/documents", json={"name": "email.md", "text": "A portal."}
    ).json()
    assert client.get(f"{BASE}/{other}/documents/{created['id']}").status_code == 404
