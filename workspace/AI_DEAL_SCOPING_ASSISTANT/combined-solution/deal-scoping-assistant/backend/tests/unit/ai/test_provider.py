"""Provider registry, startup validation and the fallback matrix (PLAN 0.1)."""

import pytest
from langchain_groq import ChatGroq
from pydantic import BaseModel, ValidationError

from app.ai.errors import AiNotConfigured
from app.ai.mock_provider import MockGenerator
from app.ai.provider import (
    PROVIDER_REQUIREMENTS,
    build_chat_model,
    build_live_generator,
    get_generator,
    resolve_ai_runtime,
)
from app.core.config import AiMode, AiProvider, Settings


def settings(**kwargs: object) -> Settings:
    return Settings(**kwargs)  # type: ignore[arg-type]


def test_live_configuration_stays_live() -> None:
    runtime = resolve_ai_runtime(
        settings(
            ai_mode="live",
            ai_provider="groq",
            ai_model="openai/gpt-oss-120b",
            groq_api_key="test-key",
        )
    )
    assert runtime.mode is AiMode.LIVE
    assert runtime.live_available is True
    assert runtime.fallback_reason == ""


def test_missing_key_falls_back_to_mock() -> None:
    runtime = resolve_ai_runtime(
        settings(ai_mode="live", ai_provider="groq", ai_model="m", groq_api_key="")
    )
    assert runtime.mode is AiMode.MOCK
    assert runtime.live_available is False
    assert "GROQ_API_KEY" in runtime.fallback_reason


def test_missing_model_falls_back_to_mock() -> None:
    runtime = resolve_ai_runtime(
        settings(ai_mode="live", ai_provider="groq", ai_model="", groq_api_key="k")
    )
    assert runtime.mode is AiMode.MOCK
    assert "AI_MODEL" in runtime.fallback_reason


def test_missing_provider_falls_back_to_mock() -> None:
    runtime = resolve_ai_runtime(settings(ai_mode="live", ai_provider=None, ai_model="m"))
    assert runtime.mode is AiMode.MOCK
    assert "AI_PROVIDER" in runtime.fallback_reason


def test_unsupported_provider_value_is_rejected() -> None:
    with pytest.raises(ValidationError):
        settings(ai_provider="openai")


def test_provider_missing_from_registry_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delitem(PROVIDER_REQUIREMENTS, AiProvider.GROQ)
    runtime = resolve_ai_runtime(
        settings(ai_mode="live", ai_provider="groq", ai_model="m", groq_api_key="k")
    )
    assert runtime.mode is AiMode.MOCK
    assert "not a supported provider" in runtime.fallback_reason


def test_mock_mode_reports_live_availability() -> None:
    runtime = resolve_ai_runtime(
        settings(ai_mode="mock", ai_provider="groq", ai_model="m", groq_api_key="k")
    )
    assert runtime.mode is AiMode.MOCK
    assert runtime.live_available is True
    assert runtime.fallback_reason == ""


def test_ollama_needs_only_a_base_url() -> None:
    runtime = resolve_ai_runtime(
        settings(
            ai_mode="live",
            ai_provider="ollama",
            ai_model="llama3.1",
            ollama_base_url="http://localhost:11434",
        )
    )
    assert runtime.mode is AiMode.LIVE


def test_build_chat_model_passes_the_key() -> None:
    model = build_chat_model(
        settings(
            ai_mode="live",
            ai_provider="groq",
            ai_model="openai/gpt-oss-120b",
            groq_api_key="test-key",
            ai_temperature=0.1,
        )
    )
    assert isinstance(model, ChatGroq)
    assert model.groq_api_key is not None
    assert model.groq_api_key.get_secret_value() == "test-key"
    assert model.temperature == 0.1


def test_build_chat_model_applies_the_budget_settings() -> None:
    model = build_chat_model(
        settings(
            ai_mode="live",
            ai_provider="groq",
            ai_model="openai/gpt-oss-120b",
            groq_api_key="test-key",
            ai_max_output_tokens=1200,
            ai_reasoning_effort="low",
        )
    )
    assert isinstance(model, ChatGroq)
    assert model.max_tokens == 1200
    assert model.reasoning_effort == "low"
    assert model.max_retries == 0  # we wait for retry-after ourselves


def test_reasoning_effort_is_ignored_for_providers_that_do_not_take_it() -> None:
    model = build_chat_model(
        settings(
            ai_mode="live",
            ai_provider="google_genai",
            ai_model="gemini-2.5-flash",
            google_api_key="test-key",
            ai_reasoning_effort="low",
        )
    )
    assert getattr(model, "reasoning_effort", None) is None


def test_optional_limits_have_shipping_defaults() -> None:
    # `_env_file=None` ignores a developer's own .env, so the defaults are what ships.
    values = Settings(_env_file=None)
    assert values.ai_max_output_tokens == 16384
    assert values.ai_reasoning_effort == ""


def test_an_empty_output_limit_lets_the_provider_decide() -> None:
    values = Settings(_env_file=None, AI_MAX_OUTPUT_TOKENS="")  # type: ignore[call-arg]
    assert values.ai_max_output_tokens is None
    model = build_chat_model(
        settings(
            ai_mode="live",
            ai_provider="groq",
            ai_model="m",
            groq_api_key="k",
            ai_max_output_tokens=None,
        )
    )
    assert isinstance(model, ChatGroq)
    assert model.max_tokens is None


def test_build_chat_model_without_key_raises() -> None:
    with pytest.raises(AiNotConfigured):
        build_chat_model(
            settings(ai_mode="live", ai_provider="groq", ai_model="m", groq_api_key="")
        )


def test_live_generator_label() -> None:
    generator = build_live_generator(
        settings(ai_mode="live", ai_provider="groq", ai_model="m", groq_api_key="k")
    )
    assert generator.label == "live:groq/m"
    assert generator.method == "json_schema"


def test_get_generator_returns_mock_when_not_live() -> None:
    generator = get_generator(settings(ai_mode="mock"), scenario_slug="demo")
    assert isinstance(generator, MockGenerator)
    assert generator.scenario_slug == "demo"


def test_unknown_model_is_a_configuration_error_not_a_repair() -> None:
    from app.ai.errors import AiNotConfigured
    from app.ai.provider import LiveGenerator

    class Model:
        def with_structured_output(self, schema: object, **kwargs: object) -> "Model":
            return self

        def invoke(self, messages: object) -> object:
            raise RuntimeError("404 NOT_FOUND. This model is no longer available to new users")

    generator = LiveGenerator(
        model=Model(), method="json_schema", label="live:google_genai/gemini-x"
    )  # type: ignore[arg-type]
    with pytest.raises(AiNotConfigured, match="not available for this key"):
        generator.generate("prd", BaseModel, "system", "user")
