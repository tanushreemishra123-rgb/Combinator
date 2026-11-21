"""Generic OpenAI-compatible chat-completions provider.

Responsibility: talk to any vendor that exposes OpenAI's ``POST /chat/completions``
shape - Google Gemini through its OpenAI compatibility layer - over plain
``httpx``, and map every way that can go wrong onto the engine's typed errors
exactly as :mod:`app.providers.groq` does:

================================================  ==========================
Vendor / transport situation                      Engine error
================================================  ==========================
HTTP status, auth, rate-limit, connection errors  :class:`ModelFailure`
per-call timeout (ours or the socket's)           :class:`StepTimeout`
response that is not the JSON we asked for        :class:`InvalidOutputError`
================================================  ==========================

That identical mapping is what lets the Retry / Timeout / Fallback guards react to
Gemini exactly as they react to Groq or to an injected failure. Prompt
shaping and answer parsing are shared with the Groq provider through
:mod:`app.providers._prompting`, so switching vendors cannot change what a block
asks for or how its answer is read.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx

from app.engine.errors import InvalidOutputError, ModelFailure, StepTimeout
from app.engine.ports import ModelResult
from app.providers._prompting import (
    build_messages,
    confidence_of,
    extract_message_text,
    strip_fence,
    wants_json,
)

DEFAULT_TIMEOUT_S = 30.0
DEFAULT_TEMPERATURE = 0.2

#: Hard ceiling on the answer length of any one block, so a runaway generation
#: costs a bounded number of tokens and cannot outlive the step's timeout.
DEFAULT_MAX_OUTPUT_TOKENS = 2048

#: Path appended to a provider's base URL for one chat completion.
CHAT_COMPLETIONS_PATH = "chat/completions"

# ------------------------------------------------------------------ endpoints
# Baked in here (rather than in the factory) so "which URL is Gemini?" has one
# answer in the codebase; the factory only decides which of them to build.

#: Google Gemini's OpenAI-compatible endpoint.
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
GEMINI_DEFAULT_MODEL = "gemini-2.5-flash"
ENV_GEMINI_API_KEY = "GEMINI_API_KEY"
ENV_GEMINI_MODEL = "GEMINI_MODEL"


class OpenAICompatProvider:
    """A :class:`~app.engine.ports.ModelPort` over an OpenAI-compatible HTTP API.

    Args:
        api_key: bearer token for the vendor.
        base_url: the API root, e.g. ``https://generativelanguage.googleapis.com/v1beta/openai/``.
        model: default model id, overridable per block via ``prompt_config["model"]``.
        provider_name: trace-label prefix, e.g. ``gemini`` -> ``gemini:gemini-2.5-flash``.
        timeout_s: per-call wall-clock budget; exceeding it raises :class:`StepTimeout`.
        temperature: default sampling temperature.
        max_output_tokens: cap on the tokens one completion may generate.
        client: pre-built ``httpx.AsyncClient`` (tests inject a fake here). When
            omitted a client is created per call and closed again, so nothing is
            left open between runs.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str,
        model: str,
        provider_name: str,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        temperature: float = DEFAULT_TEMPERATURE,
        max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS,
        client: Any = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url if base_url.endswith("/") else f"{base_url}/"
        self.model = model
        self.name = provider_name
        self.timeout_s = timeout_s
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self._client = client

    # ------------------------------------------------------------------ port

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult:
        """Run one chat completion and parse it into a :class:`ModelResult`."""
        prompt_config = dict(prompt_config or {})
        model = str(prompt_config.get("model") or self.model)
        expects_json = wants_json(prompt_config)
        request: dict[str, Any] = {
            "model": model,
            "messages": build_messages(prompt_config, data),
            "temperature": float(
                prompt_config.get("temperature", self.temperature) or 0.0
            ),
            "max_tokens": self.max_output_tokens,
        }
        if expects_json:
            request["response_format"] = {"type": "json_object"}

        completion = await self._create(request, model)
        text = extract_message_text(
            completion, provider_label=self.provider_name(model), brand=self.brand
        )
        parsed, confidence = self._parse(text, expects_json, model)
        return ModelResult(
            data=parsed,
            confidence=confidence,
            raw=text,
            provider_used=self.provider_name(model),
            mocked=False,
        )

    # --------------------------------------------------------------- helpers

    def provider_name(self, model: str | None = None) -> str:
        """Trace label for this provider, e.g. ``gemini:gemini-2.5-flash``."""
        return f"{self.name}:{model or self.model}"

    @property
    def brand(self) -> str:
        """How this vendor is named in an error message, e.g. ``Gemini``."""
        return self.name.capitalize()

    def wants_json(self, prompt_config: dict[str, Any]) -> bool:
        """True when the block declares a structured answer is expected."""
        return wants_json(prompt_config)

    def build_messages(
        self, prompt_config: dict[str, Any], data: Any
    ) -> list[dict[str, str]]:
        """Compose the chat messages - identical to the Groq provider's."""
        return build_messages(prompt_config, data)

    def headers(self) -> dict[str, str]:
        """Auth and content headers for one request."""
        return {
            "Authorization": f"Bearer {self.api_key or ''}",
            "Content-Type": "application/json",
        }

    async def _create(self, request: dict[str, Any], model: str) -> Any:
        """POST the completion under our own timeout, mapping errors to engine errors."""
        try:
            return await asyncio.wait_for(self._post(request), self.timeout_s)
        except TimeoutError as exc:
            raise StepTimeout(
                f"The {self.brand} request took longer than {self.timeout_s:g}s.",
                detail={
                    "provider": self.provider_name(model),
                    "timeout_s": self.timeout_s,
                },
            ) from exc
        except httpx.TimeoutException as exc:  # the socket's own timeout
            raise StepTimeout(
                f"{self.brand} timed out while answering.",
                detail={"provider": self.provider_name(model), "error": str(exc)},
            ) from exc
        except ModelFailure:
            raise
        except Exception as exc:
            raise ModelFailure(
                f"{self.brand} could not answer: {exc}"
                if str(exc)
                else f"{self.brand} could not answer.",
                detail={
                    "provider": self.provider_name(model),
                    "error_type": type(exc).__name__,
                    **_status_detail(exc),
                },
            ) from exc

    async def _post(self, request: dict[str, Any]) -> Any:
        """Send the request, reusing an injected client or opening a scoped one."""
        if self._client is not None:
            return await self._send(self._client, request)
        async with httpx.AsyncClient(
            base_url=self.base_url, headers=self.headers(), timeout=self.timeout_s
        ) as client:
            return await self._send(client, request)

    async def _send(self, client: Any, request: dict[str, Any]) -> Any:
        """One POST plus status check; the parsed JSON body comes back."""
        response = await client.post(CHAT_COMPLETIONS_PATH, json=request)
        response.raise_for_status()
        return response.json()

    def _parse(
        self, text: str, expects_json: bool, model: str
    ) -> tuple[Any, float | None]:
        """Parse the completion text; raise :class:`InvalidOutputError` if unusable."""
        if not expects_json:
            return text, None
        try:
            parsed = json.loads(strip_fence(text))
        except (ValueError, TypeError) as exc:
            raise InvalidOutputError(
                "The model did not return valid JSON.",
                detail={
                    "provider": self.provider_name(model),
                    "raw": text,
                    "parse_error": str(exc),
                },
            ) from exc
        return parsed, confidence_of(parsed)


# --------------------------------------------------------------------- module


def gemini_provider(
    api_key: str | None,
    model: str = GEMINI_DEFAULT_MODEL,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> OpenAICompatProvider:
    """Google Gemini through its OpenAI compatibility layer."""
    return OpenAICompatProvider(
        api_key=api_key,
        base_url=GEMINI_BASE_URL,
        model=model,
        provider_name="gemini",
        timeout_s=timeout_s,
    )


def _status_detail(exc: Exception) -> dict[str, Any]:
    """Add the HTTP status to the error detail when the vendor answered with one."""
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return {"status_code": status} if isinstance(status, int) else {}
