"""Scope endpoints: grouped listing, item edits, questions, assumptions, approval."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app

BASE = "/api/v1/sessions"
REF = {"document_id": "D1", "segment_id": "D1.S1", "quote": "a portal", "verified": True}


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def session_id(client: TestClient) -> str:
    return str(client.post(BASE, json={"name": "Scope"}).json()["id"])


def _requirement(title: str = "Portal") -> dict[str, Any]:
    return {"type": "FR", "title": title, "origin": "customer_stated", "source_refs": [REF]}


def _question() -> dict[str, Any]:
    return {
        "type": "Q",
        "title": "How many users?",
        "origin": "ai_inferred",
        "source_refs": [REF],
        "details": {"question": {"why_it_matters": "Sizing"}},
    }


def _assumption() -> dict[str, Any]:
    return {
        "type": "ASM",
        "title": "5000 users",
        "origin": "assumed",
        "related_ids": ["Q_01"],
        "details": {"assumption": {"impact_if_wrong": "Sizing changes"}},
    }


def test_scope_is_grouped_by_type(client: TestClient, session_id: str) -> None:
    client.post(f"{BASE}/{session_id}/scope/items", json=_requirement("Portal"))
    client.post(f"{BASE}/{session_id}/scope/items", json=_question())
    client.post(f"{BASE}/{session_id}/scope/items", json=_requirement("Reports"))
    body = client.get(f"{BASE}/{session_id}/scope").json()
    assert body["scope_status"] == "empty"
    assert body["locked"] is False
    assert [group["type"] for group in body["groups"]] == ["FR", "Q"]
    assert [item["id"] for item in body["groups"][0]["items"]] == ["FR_01", "FR_02"]


def test_item_crud(client: TestClient, session_id: str) -> None:
    created = client.post(f"{BASE}/{session_id}/scope/items", json=_requirement())
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]
    assert created.json()["updated_by"] == "user"

    patched = client.patch(
        f"{BASE}/{session_id}/scope/items/{item_id}",
        json={"title": "Self-service portal", "priority": "must"},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Self-service portal"
    assert patched.json()["version"] == 2

    assert client.delete(f"{BASE}/{session_id}/scope/items/{item_id}").status_code == 204
    assert client.get(f"{BASE}/{session_id}/scope").json()["groups"] == []
    assert (
        client.patch(f"{BASE}/{session_id}/scope/items/{item_id}", json={"title": "x"}).status_code
        == 404
    )


def test_answer_question_and_decide_assumption(client: TestClient, session_id: str) -> None:
    question_id = client.post(f"{BASE}/{session_id}/scope/items", json=_question()).json()["id"]
    assumption_id = client.post(f"{BASE}/{session_id}/scope/items", json=_assumption()).json()["id"]

    answered = client.post(
        f"{BASE}/{session_id}/scope/questions/{question_id}/answer",
        json={"answer": "About 5,000 named users."},
    )
    assert answered.status_code == 200, answered.text
    assert answered.json()["details"]["question"]["answer_status"] == "answered"

    confirmed = client.post(f"{BASE}/{session_id}/scope/assumptions/{assumption_id}/confirm")
    assert confirmed.json()["details"]["assumption"]["confirmation_status"] == "confirmed"
    rejected = client.post(f"{BASE}/{session_id}/scope/assumptions/{assumption_id}/reject")
    assert rejected.json()["details"]["assumption"]["confirmation_status"] == "rejected"
    assert rejected.json()["status"] == "rejected"

    wrong_type = client.post(
        f"{BASE}/{session_id}/scope/assumptions/{question_id}/confirm",
    )
    assert wrong_type.status_code == 422


def test_approve_then_every_mutation_is_409(client: TestClient, session_id: str) -> None:
    item_id = client.post(f"{BASE}/{session_id}/scope/items", json=_requirement()).json()["id"]
    approved = client.post(f"{BASE}/{session_id}/scope/approve")
    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert body["scope_version"] == 1
    assert body["scope_status"] == "approved"
    assert body["locked"] is True
    assert body["groups"][0]["items"][0]["status"] == "approved"

    for response in (
        client.post(f"{BASE}/{session_id}/scope/items", json=_requirement("Another")),
        client.patch(f"{BASE}/{session_id}/scope/items/{item_id}", json={"title": "x"}),
        client.delete(f"{BASE}/{session_id}/scope/items/{item_id}"),
        client.post(f"{BASE}/{session_id}/scope/approve"),
    ):
        assert response.status_code == 409
        assert f"/sessions/{session_id}/changes" in response.json()["detail"]


def test_approve_without_items_is_409(client: TestClient, session_id: str) -> None:
    response = client.post(f"{BASE}/{session_id}/scope/approve")
    assert response.status_code == 409
    assert "nothing to approve" in response.json()["detail"]


def test_user_typed_item_without_a_source_ref_is_accepted(
    client: TestClient, session_id: str
) -> None:
    response = client.post(
        f"{BASE}/{session_id}/scope/items",
        json={"type": "FR", "title": "Portal", "origin": "customer_stated"},
    )
    assert response.status_code == 201
    assert response.json()["updated_by"] == "user"
