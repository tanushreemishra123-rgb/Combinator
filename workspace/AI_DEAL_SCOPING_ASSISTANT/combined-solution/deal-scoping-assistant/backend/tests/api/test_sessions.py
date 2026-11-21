"""Session endpoints: CRUD, locking after approval and cascade delete."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import ScopeItem as ItemRow
from app.db.models import SourceDocument as DocumentRow
from app.db.session import get_session_factory
from app.main import app

BASE = "/api/v1/sessions"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create(client: TestClient, name: str = "Halvard Mutual") -> dict[str, object]:
    response = client.post(BASE, json={"name": name, "customer_name": "Halvard"})
    assert response.status_code == 201, response.text
    return dict(response.json())


def test_create_read_list_and_patch(client: TestClient) -> None:
    created = _create(client)
    assert created["scope_status"] == "empty"
    assert created["scope_version"] == 0
    assert created["ai_mode"] == "mock"

    session_id = created["id"]
    assert client.get(f"{BASE}/{session_id}").json()["name"] == "Halvard Mutual"
    assert any(row["id"] == session_id for row in client.get(BASE).json())

    patched = client.patch(
        f"{BASE}/{session_id}",
        json={
            "name": "Halvard Mutual - modernization",
            "customer_name": "Halvard Mutual Insurance Group",
            "opportunity_context": "Policy platform move to Azure.",
            "cloud_platform": "azure",
            "config": {"expected_users": 5000, "target_regions": ["Norway East"]},
        },
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["cloud_platform"] == "azure"
    assert body["config"]["expected_users"] == 5000
    assert body["opportunity_context"] == "Policy platform move to Azure."


def test_unknown_session_returns_a_problem_document(client: TestClient) -> None:
    response = client.get(f"{BASE}/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["title"] == "Not Found"


def test_invalid_create_is_a_422_problem(client: TestClient) -> None:
    response = client.post(BASE, json={"name": ""})
    assert response.status_code == 422
    assert response.json()["type"].endswith("validation-failed")


def test_switching_the_rate_card_drops_overrides_priced_in_the_old_currency(
    client: TestClient,
) -> None:
    session_id = _create(client)["id"]
    config = client.get(f"{BASE}/{session_id}").json()["config"]
    config["rate_overrides"] = [{"role": "Solution Architect", "rate_per_person_week": 9900}]
    assert client.patch(f"{BASE}/{session_id}", json={"config": config}).status_code == 200

    config["rate_card_id"] = "eur-standard"
    saved = client.patch(f"{BASE}/{session_id}", json={"config": config}).json()["config"]

    assert saved["rate_card_id"] == "eur-standard"
    assert saved["rate_overrides"] == []


def test_config_and_platform_are_locked_after_approval(client: TestClient) -> None:
    session_id = _create(client)["id"]
    client.post(
        f"{BASE}/{session_id}/documents", json={"name": "brief.md", "text": "# Brief\n\nA portal."}
    )
    item = client.post(
        f"{BASE}/{session_id}/scope/items",
        json={
            "type": "FR",
            "title": "Portal",
            "origin": "customer_stated",
            "source_refs": [{"document_id": "D1", "segment_id": "D1.S1", "quote": "A portal."}],
        },
    )
    assert item.status_code == 201, item.text
    assert client.post(f"{BASE}/{session_id}/scope/approve").status_code == 200

    # The name is descriptive only, so it stays editable.
    assert client.patch(f"{BASE}/{session_id}", json={"name": "Renamed"}).status_code == 200

    blocked = client.patch(f"{BASE}/{session_id}", json={"config": {"expected_users": 9}})
    assert blocked.status_code == 409
    assert "/changes" in blocked.json()["detail"]
    assert client.patch(f"{BASE}/{session_id}", json={"cloud_platform": "gcp"}).status_code == 409


def test_delete_removes_the_session_and_everything_under_it(client: TestClient) -> None:
    session_id = str(_create(client)["id"])
    client.post(
        f"{BASE}/{session_id}/documents", json={"name": "brief.md", "text": "# Brief\n\nA portal."}
    )
    client.post(
        f"{BASE}/{session_id}/scope/items",
        json={
            "type": "FR",
            "title": "Portal",
            "origin": "customer_stated",
            "source_refs": [{"document_id": "D1", "segment_id": "D1.S1", "quote": "A portal."}],
        },
    )
    assert client.delete(f"{BASE}/{session_id}").status_code == 204
    assert client.get(f"{BASE}/{session_id}").status_code == 404
    with get_session_factory()() as db:
        documents = db.scalars(
            select(DocumentRow).where(DocumentRow.session_id == session_id)
        ).all()
        items = db.scalars(select(ItemRow).where(ItemRow.session_id == session_id)).all()
    assert list(documents) == []
    assert list(items) == []
