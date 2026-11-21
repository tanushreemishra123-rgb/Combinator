"""Provider registry, startup validation with fallback to mock, and the live generator."""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol, TypeVar

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.ai.errors import AiNotConfigured, AiProviderUnavailable, AiRequestTooLarge
from app.ai.rate_limit import (
    BUDGET_TOO_SMALL_MESSAGE,
    MAX_WAITS,
    is_model_not_found,
    is_retryable,
    is_token_limit,
    wait_seconds,
)
from app.core.config import AiMode, AiProvider, Settings
from app.core.errors import AIStageFailed
from app.domain.base import DomainModel

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=BaseModel)

# provider -> the setting that must be filled for it (PLAN section 0.1).
PROVIDER_REQUIREMENTS: dict[AiProvider, str] = {
    AiProvider.GOOGLE_GENAI: "GOOGLE_API_KEY",
    AiProvider.GROQ: "GROQ_API_KEY",
    AiProvider.OLLAMA: "OLLAMA_BASE_URL",
}

# Every provider's native structured-output API: Gemini's `response_json_schema`, Groq's
# structured outputs and Ollama's schema-constrained format. They hold our large schemas
# better than tool calling does.
STRUCTURED_OUTPUT_METHOD: dict[AiProvider, str] = {
    AiProvider.GOOGLE_GENAI: "json_schema",
    AiProvider.GROQ: "json_schema",
    AiProvider.OLLAMA: "json_schema",
}


# Ollama names the output cap differently; everything else follows the OpenAI wording.
_OUTPUT_TOKENS_OPTION: dict[AiProvider, str] = {
    AiProvider.GOOGLE_GENAI: "max_tokens",
    AiProvider.GROQ: "max_tokens",
    AiProvider.OLLAMA: "num_predict",
}


class AiRuntime(DomainModel):
    """What the app will actually do, after validating the configuration."""

    mode: AiMode = Field(description="Mode in use after validation: mock or live.")
    provider: AiProvider | None = Field(description="Configured provider, when valid.")
    model: str = Field(description="Configured model id.")
    live_available: bool = Field(description="True when live calls can be made.")
    fallback_reason: str = Field(
        default="", description="Why live mode fell back to mock, when it did."
    )


def _live_problem(settings: Settings) -> str:
    """Empty string when the live configuration is complete."""
    provider = settings.ai_provider
    if provider is None:
        return "AI_PROVIDER is not set"
    if provider not in PROVIDER_REQUIREMENTS:
        return f"AI_PROVIDER '{provider}' is not a supported provider"
    if not settings.ai_model.strip():
        return "AI_MODEL is not set"
    if not settings.provider_key().strip():
        return f"{PROVIDER_REQUIREMENTS[provider]} is not set"
    return ""


def resolve_ai_runtime(settings: Settings) -> AiRuntime:
    """Startup validation: live mode needs provider, model and credential, else mock."""
    problem = _live_problem(settings)
    live_available = not problem
    if settings.ai_mode is AiMode.LIVE and live_available:
        mode, reason = AiMode.LIVE, ""
    elif settings.ai_mode is AiMode.LIVE:
        mode, reason = AiMode.MOCK, f"live mode unavailable: {problem}"
    else:
        mode, reason = AiMode.MOCK, ""
    return AiRuntime(
        mode=mode,
        provider=settings.ai_provider,
        model=settings.ai_model,
        live_available=live_available,
        fallback_reason=reason,
    )


def build_chat_model(settings: Settings) -> BaseChatModel:
    """Build the configured chat model; the credential comes straight from SecretStr."""
    problem = _live_problem(settings)
    if problem or settings.ai_provider is None:
        raise AiNotConfigured(problem or "AI provider is not configured")
    provider = settings.ai_provider
    credential = settings.provider_key()
    options: dict[str, Any] = {
        "temperature": settings.ai_temperature,
        "timeout": settings.ai_timeout_seconds,
        # We wait for the provider's retry-after ourselves, so the SDK must not also retry.
        "max_retries": 0,
        _OUTPUT_TOKENS_OPTION[provider]: settings.ai_max_output_tokens,
    }
    if provider is AiProvider.OLLAMA:
        options["base_url"] = credential
    else:
        options["api_key"] = credential
    if settings.ai_reasoning_effort and provider is AiProvider.GROQ:
        # Only Groq's reasoning models take this; it keeps thinking tokens inside the budget.
        options["reasoning_effort"] = settings.ai_reasoning_effort
    model = init_chat_model(model=settings.ai_model, model_provider=provider.value, **options)
    if not isinstance(model, BaseChatModel):
        raise AiNotConfigured("the configured provider did not return a chat model")
    return model


class StructuredGenerator(Protocol):
    """What every stage needs from an AI backend: one validated object per call."""

    label: str

    def generate(self, stage: str, schema: type[T], system: str, user: str) -> T: ...


@dataclass
class LiveGenerator:
    """Calls the configured provider once per stage and parses the answer into `schema`."""

    model: BaseChatModel
    method: str
    label: str
    sleep: Callable[[float], None] = time.sleep
    # Token usage of every call, for the recording script and for sizing the stages.
    usage: list[tuple[str, dict[str, int]]] = field(default_factory=list)

    def _invoke(self, schema: type[T], system: str, user: str) -> tuple[T, Any]:
        structured = self.model.with_structured_output(schema, method=self.method, include_raw=True)
        answer = structured.invoke([SystemMessage(system), HumanMessage(user)])
        if not isinstance(answer, dict):
            raise AIStageFailed(f"the provider returned {type(answer).__name__}, not an answer")
        if answer.get("parsing_error"):
            raise AIStageFailed(str(answer["parsing_error"]))
        parsed = answer.get("parsed")
        if not isinstance(parsed, schema):
            raise AIStageFailed(f"the provider returned {type(parsed).__name__}, not {schema}")
        return parsed, answer.get("raw")

    def generate(self, stage: str, schema: type[T], system: str, user: str) -> T:
        for attempt in range(MAX_WAITS + 1):
            try:
                parsed, raw = self._invoke(schema, system, user)
            except AIStageFailed:
                raise
            except Exception as exc:
                if is_token_limit(exc):
                    raise AiRequestTooLarge(BUDGET_TOO_SMALL_MESSAGE) from exc
                if is_model_not_found(exc):
                    raise AiNotConfigured(
                        f"The model '{self.label.split('/', 1)[-1]}' is not available for this "
                        "key. Check AI_MODEL and pick a model your provider lists."
                    ) from exc
                if is_retryable(exc):
                    # Rate limited or the model is busy: the same request can still work.
                    if attempt < MAX_WAITS:
                        self.sleep(wait_seconds(exc))
                        continue
                    raise AiProviderUnavailable(
                        f"The AI provider stayed unavailable after {MAX_WAITS} retries: {exc}"
                    ) from exc
                raise
            usage = getattr(raw, "usage_metadata", None)
            self.usage.append((stage, dict(usage) if usage else {}))
            return parsed
        raise AiProviderUnavailable(f"stage {stage} did not complete")


def build_live_generator(settings: Settings) -> LiveGenerator:
    provider = settings.ai_provider
    if provider is None:
        raise AiNotConfigured("AI_PROVIDER is not set")
    return LiveGenerator(
        model=build_chat_model(settings),
        method=STRUCTURED_OUTPUT_METHOD[provider],
        label=f"live:{provider.value}/{settings.ai_model}",
    )


def get_generator(
    settings: Settings, scenario_slug: str = "", scenarios_dir: Path | None = None
) -> StructuredGenerator:
    """Live generator when the configuration validates, otherwise recorded mock responses."""
    if resolve_ai_runtime(settings).mode is AiMode.LIVE:
        return build_live_generator(settings)
    from app.ai.mock_provider import MockGenerator  # local import: mock imports this module

    mock = MockGenerator(scenario_slug=scenario_slug)
    if scenarios_dir is not None:
        mock.scenarios_dir = scenarios_dir
    generator: StructuredGenerator = mock
    return generator
