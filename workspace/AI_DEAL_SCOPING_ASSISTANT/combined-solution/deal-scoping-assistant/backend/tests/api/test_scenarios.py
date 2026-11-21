"""Scenario listing and session creation, against a temporary seeds directory."""

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.errors import NotFound
from app.main import app
from app.sessions.scenarios import get_scenarios_dir, load_scenario

BASE = "/api/v1"

CONTEXT = {
    "slug": "demo-modernization",
    "title": "Demo Modernization",
    "scenario_type": "application_modernization",
    "customer_name": "Demo Mutual",
    "industry": "Insurance",
    "opportunity_summary": "Move the policy platform to Azure.",
    "requested_by": "Ingrid, Director of IT",
    "preferred_cloud": "azure",
    "expected_users": 5000,
    "target_regions": ["Norway East"],
    "delivery_deadline": "2027-03-31",
    "regulatory_constraints": ["GDPR"],
    "demo_change": {
        "description": "Open the portal to every policyholder.",
        "config_key": "expected_users",
        "from": 5000,
        "to": 500000,
    },
}

REQUIREMENTS = "# Background\n\nThe policy platform must move to Azure.\n"


@pytest.fixture
def seeds(tmp_path: Path) -> Path:
    directory = tmp_path / CONTEXT["slug"]  # type: ignore[operator]
    directory.mkdir()
    (directory / "context.json").write_text(json.dumps(CONTEXT), encoding="utf-8")
    (directory / "requirements.md").write_text(REQUIREMENTS, encoding="utf-8")
    # A folder without a context file must be ignored by the listing.
    (tmp_path / "not-a-scenario").mkdir()
    return tmp_path


@pytest.fixture
def client(seeds: Path) -> Iterator[TestClient]:
    app.dependency_overrides[get_scenarios_dir] = lambda: seeds
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_listing_returns_the_scenario_context(client: TestClient) -> None:
    response = client.get(f"{BASE}/scenarios")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["slug"] == "demo-modernization"
    assert body[0]["preferred_cloud"] == "azure"
    assert body[0]["demo_change"]["from"] == 5000
    assert body[0]["demo_change"]["to"] == 500000


def test_session_from_scenario_copies_context_and_pastes_requirements(
    client: TestClient,
) -> None:
    response = client.post(f"{BASE}/sessions/from-scenario/demo-modernization")
    assert response.status_code == 201, response.text
    session = response.json()
    assert session["name"] == "Demo Modernization"
    assert session["customer_name"] == "Demo Mutual"
    assert session["opportunity_context"] == "Move the policy platform to Azure."
    assert session["cloud_platform"] == "azure"
    assert session["platform_mode"] == "selected"
    assert session["scenario_slug"] == "demo-modernization"
    assert session["config"]["expected_users"] == 5000
    assert session["config"]["target_regions"] == ["Norway East"]
    assert session["config"]["delivery_deadline"] == "2027-03-31"
    assert session["config"]["regulatory_constraints"] == ["GDPR"]

    documents = client.get(f"{BASE}/sessions/{session['id']}/documents").json()
    assert [document["name"] for document in documents] == ["requirements.md"]
    stored = client.get(f"{BASE}/sessions/{session['id']}/documents/{documents[0]['id']}").json()
    assert "must move to Azure" in stored["normalized_text"]
    assert stored["segments"][0]["kind"] == "heading"


def test_scenario_without_a_cloud_preference_asks_for_a_recommendation(
    client: TestClient, seeds: Path
) -> None:
    context = dict(CONTEXT, slug="open-platform", preferred_cloud=None, expected_users=None)
    directory = seeds / "open-platform"
    directory.mkdir()
    (directory / "context.json").write_text(json.dumps(context), encoding="utf-8")
    (directory / "requirements.md").write_text(REQUIREMENTS, encoding="utf-8")
    session = client.post(f"{BASE}/sessions/from-scenario/open-platform").json()
    assert session["cloud_platform"] is None
    assert session["platform_mode"] == "recommended"
    assert session["config"]["expected_users"] is None


@pytest.mark.parametrize("slug", ["missing-scenario", "Demo-Modernization", "demo_x"])
def test_unknown_slugs_are_404(client: TestClient, slug: str) -> None:
    response = client.post(f"{BASE}/sessions/from-scenario/{slug}")
    assert response.status_code == 404, response.text
    assert response.headers["content-type"].startswith("application/problem+json")


@pytest.mark.parametrize("slug", ["..", "../seeds", "demo-modernization/../..", "/etc"])
def test_paths_are_never_built_from_an_unvalidated_slug(seeds: Path, slug: str) -> None:
    with pytest.raises(NotFound):
        load_scenario(seeds, slug)
