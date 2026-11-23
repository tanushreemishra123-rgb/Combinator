from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import AiMode, Settings, get_settings
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_system_reports_mock_mode_without_provider(client: TestClient) -> None:
    body = client.get("/api/v1/system").json()
    assert body["ai_mode"] == AiMode.MOCK.value
    assert body["provider"] == ""
    assert body["live_available"] is False
    assert body["fallback_reason"] == ""


def test_system_reports_fallback_reason_for_live_without_key(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,  # type: ignore[call-arg]
        ai_mode="live",
        ai_provider="google_genai",
        ai_model="gemini-2.5-flash",
        google_api_key="",
    )
    body = client.get("/api/v1/system").json()
    assert body["ai_mode"] == AiMode.MOCK.value
    assert body["live_available"] is False
    # /system reports the same reason the generation layer would give.
    assert "GOOGLE_API_KEY" in body["fallback_reason"]


def test_system_never_returns_keys(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,  # type: ignore[call-arg]
        ai_mode="live",
        ai_provider="groq",
        ai_model="llama-3.3-70b",
        groq_api_key="gsk-should-not-appear",
    )
    response = client.get("/api/v1/system")
    assert "gsk-should-not-appear" not in response.text
    body = response.json()
    assert body["ai_mode"] == AiMode.LIVE.value
    assert body["live_available"] is True
    assert set(body) == {"ai_mode", "provider", "model", "live_available", "fallback_reason"}


def test_cors_headers_use_configured_origin(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_export_filename_header_is_readable_across_origins(client: TestClient) -> None:
    # Exposed headers travel on the real response, not on the preflight.
    response = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert (
        "content-disposition" in response.headers.get("access-control-expose-headers", "").lower()
    )
