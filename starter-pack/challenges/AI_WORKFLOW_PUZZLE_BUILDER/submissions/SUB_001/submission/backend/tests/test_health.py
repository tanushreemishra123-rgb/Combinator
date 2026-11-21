"""The health endpoint reports the real model-provider mode."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.groq import DEFAULT_MODEL
from app.providers.openai_compat import GEMINI_DEFAULT_MODEL

client = TestClient(app)

NO_PROVIDERS = {"groq": False, "gemini": False}


def test_health_reports_mock_mode_without_a_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "mode": "mock",
        "provider": "mock",
        "groq_configured": False,
        "providers": NO_PROVIDERS,
    }


def test_health_reports_live_mode_when_a_key_is_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    response = client.get("/api/health")

    assert response.json() == {
        "status": "ok",
        "mode": "live",
        "provider": f"groq:{DEFAULT_MODEL}",
        "groq_configured": True,
        "providers": {"groq": True, "gemini": False},
    }


def test_health_reports_mock_mode_when_the_key_is_pinned_off(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("PUZZLE_FORCE_MOCK", "1")

    body = client.get("/api/health").json()

    assert body["mode"] == "mock"
    assert body["groq_configured"] is True
    assert body["providers"]["groq"] is True


def test_health_reports_a_gemini_only_setup(monkeypatch: pytest.MonkeyPatch):
    """A Gemini key alone is a live setup, and back-compat fields stay honest."""
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")

    body = client.get("/api/health").json()

    assert body["mode"] == "live"
    assert body["provider"] == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert body["groq_configured"] is False
    assert body["providers"] == {"groq": False, "gemini": True}


def test_health_reports_every_configured_provider(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-pro")

    body = client.get("/api/health").json()

    assert body["provider"] == "gemini:gemini-2.5-pro"
    assert body["providers"] == {"groq": True, "gemini": True}
