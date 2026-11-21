"""Focused checks around the orchestration: hashes, notices, mock fallback, documents."""

from fastapi.testclient import TestClient

from app.artifacts.service import config_hash
from app.core.config import Settings, get_settings
from app.db.models import Session as SessionRow
from app.main import app
from tests.api.journey import SLUG, Journey, start


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {"ai_mode": "mock", **overrides}
    return Settings(_env_file=None, **values)  # type: ignore[arg-type,call-arg]


def test_config_hash_is_stable_and_follows_the_inputs() -> None:
    row = SessionRow(name="s", config={"expected_users": 100}, cloud_platform="aws")
    same = SessionRow(name="other", config={"expected_users": 100}, cloud_platform="aws")
    assert config_hash(row) == config_hash(row) == config_hash(same)

    row.config = {"expected_users": 200}
    changed = config_hash(row)
    assert changed != config_hash(same)
    row.cloud_platform = "azure"
    assert config_hash(row) != changed


def test_artifacts_record_the_scope_version_and_config_hash(journey: Journey) -> None:
    journey.generate("prd")
    artifact = journey.get("/artifacts/prd")
    assert artifact["scope_version_used"] == journey.get("")["scope_version"]
    assert len(artifact["config_hash_used"]) == 12
    assert artifact["generated_by"] == "mock:recorded"
    assert artifact["status"] == "fresh"
    assert journey.generate("prd")["artifact"]["version"] == 2


def test_a_session_without_a_scenario_cannot_be_analyzed_in_mock_mode(
    seeded_client: TestClient,
) -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    session_id = seeded_client.post("/api/v1/sessions", json={"name": "Pasted input"}).json()["id"]
    base = f"/api/v1/sessions/{session_id}"
    seeded_client.post(
        f"{base}/documents",
        json={"name": "notes.md", "text": "The portal must let customers track shipments."},
    )
    response = seeded_client.post(f"{base}/analysis")
    assert response.status_code == 409
    assert "sample scenario" in response.json()["detail"]


def test_live_without_a_key_falls_back_to_recorded_answers(seeded_client: TestClient) -> None:
    """A misconfigured live setup must not reach a provider; /system says why."""
    app.dependency_overrides[get_settings] = lambda: _settings(
        ai_mode="live", ai_provider="groq", ai_model="llama-3.3-70b", groq_api_key=""
    )
    system = seeded_client.get("/api/v1/system").json()
    assert system["ai_mode"] == "mock"
    assert system["live_available"] is False
    assert "GROQ_API_KEY" in system["fallback_reason"]

    journey = start(seeded_client)
    result = journey.generate("prd")
    assert result["artifact"]["generated_by"] == "mock:recorded"
    assert "GROQ_API_KEY" in result["mock_notice"]


def test_a_second_document_gets_the_next_public_id(journey: Journey) -> None:
    second = journey.post(
        "/documents",
        {"name": "call-notes.md", "text": "The customer wants a status email as well."},
        expect=201,
    )
    assert second["id"] == "D2"
    assert second["segments"][0]["segment_id"] == "D2.S1"
    assert [document["id"] for document in journey.get("/documents")] == ["D1", "D2"]
    assert journey.get("/documents/D2")["name"] == "call-notes.md"
    journey.get("/documents/D9", expect=404)


def test_rate_cards_and_historical_projects_are_served(seeded_client: TestClient) -> None:
    cards = seeded_client.get("/api/v1/rate-cards").json()
    assert {card["id"] for card in cards} >= {"usd-standard", "eur-standard"}
    historical = seeded_client.get("/api/v1/estimate/historical-projects").json()
    assert "Reference only" in historical["disclaimer"]
    assert historical["projects"]


def test_running_the_analysis_again_keeps_the_same_ids(seeded_client: TestClient) -> None:
    created = seeded_client.post(f"/api/v1/sessions/from-scenario/{SLUG}").json()
    journey = Journey(client=seeded_client, session_id=created["id"])
    journey.analyze()
    first = journey.items()
    journey.analyze()
    again = journey.items()
    # A re-run replaces the scope; it must not treat the items it replaces as taken.
    assert sorted(again) == sorted(first)
    assert "FR_01" in again
