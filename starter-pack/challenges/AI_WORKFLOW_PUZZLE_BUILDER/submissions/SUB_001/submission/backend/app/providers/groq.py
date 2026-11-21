"""Live Groq model provider.

Responsibility: turn a block's prompt config plus the current workflow data into
a Groq chat completion, and map every way that can go wrong onto the engine's
typed errors:

===========================  ==========================
Groq / transport situation   Engine error
===========================  ==========================
API, auth, rate-limit, connection errors   :class:`ModelFailure`
per-call timeout (ours or Groq's)          :class:`StepTimeout`
response that is not the JSON we asked for :class:`InvalidOutputError`
===========================  ==========================

That mapping is what lets the Retry / Timeout / Fallback guards react to a live
provider exactly as they react to an injected failure.

Prompt shaping and answer parsing live in :mod:`app.providers._prompting`, shared
verbatim with :mod:`app.providers.openai_compat` (Gemini), so switching
providers cannot change what a block asks for. ``build_messages`` and
``wants_json`` remain methods here - the public surface is unchanged.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from app.engine.errors import InvalidOutputError, ModelFailure, StepTimeout
from app.engine.ports import ModelResult
from app.providers._prompting import (
    DEFAULT_SYSTEM,
    JSON_SYSTEM_SUFFIX,
    extract_message_text,
)
from app.providers._prompting import (
    build_messages as _build_messages,
)
from app.providers._prompting import (
    confidence_of as _confidence_of,
)
from app.providers._prompting import (
    strip_fence as _strip_fence,
)
from app.providers._prompting import (
    wants_json as _wants_json,
)

try:  # pragma: no cover - exercised implicitly; groq is a declared dependency
    import groq as _groq
except ImportError:  # pragma: no cover - keeps the app importable without groq
    _groq = None  # type: ignore[assignment]

DEFAULT_MODEL = "openai/gpt-oss-120b"
DEFAULT_TIMEOUT_S = 30.0
DEFAULT_TEMPERATURE = 0.2

#: Hard ceiling on the answer length of any one block, so a runaway generation
#: costs a bounded number of tokens and cannot outlive the step's timeout.
DEFAULT_MAX_OUTPUT_TOKENS = 4096

__all__ = [
    "DEFAULT_MAX_OUTPUT_TOKENS",
    "DEFAULT_MODEL",
    "DEFAULT_SYSTEM",
    "DEFAULT_TEMPERATURE",
    "DEFAULT_TIMEOUT_S",
    "JSON_SYSTEM_SUFFIX",
    "GroqModelProvider",
]


def _timeout_types() -> tuple[type[BaseException], ...]:
    """Groq exception classes that mean "took too long", if groq is installed."""
    if _groq is None:  # pragma: no cover
        return ()
    return tuple(
        cls
        for cls in (getattr(_groq, "APITimeoutError", None),)
        if isinstance(cls, type)
    )


class GroqModelProvider:
    """A :class:`~app.engine.ports.ModelPort` backed by Groq's async client.

    Args:
        api_key: Groq key; only used when ``client`` is not supplied.
        model: default model id, overridable per block via ``prompt_config["model"]``.
        client: pre-built async client (tests inject a fake here).
        timeout_s: per-call wall-clock budget; exceeding it raises :class:`StepTimeout`.
        temperature: default sampling temperature.
        max_output_tokens: cap on the tokens one completion may generate.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = DEFAULT_MODEL,
        client: Any = None,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        temperature: float = DEFAULT_TEMPERATURE,
        max_output_tokens: int = DEFAULT_MAX_OUTPUT_TOKENS,
    ) -> None:
        self.model = model
        self.timeout_s = timeout_s
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens
        self._api_key = api_key
        self._client = client

    # ------------------------------------------------------------------ port

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult:
        """Run one chat completion and parse it into a :class:`ModelResult`."""
        prompt_config = dict(prompt_config or {})
        model = str(prompt_config.get("model") or self.model)
        wants_json = self.wants_json(prompt_config)
        request: dict[str, Any] = {
            "model": model,
            "messages": self.build_messages(prompt_config, data),
            "temperature": float(
                prompt_config.get("temperature", self.temperature) or 0.0
            ),
            "max_completion_tokens": self.max_output_tokens,
        }
        if wants_json:
            request["response_format"] = {"type": "json_object"}

        completion = await self._create(request, model)
        text = _extract_text(completion, model)
        parsed, confidence = self._parse(text, wants_json, model)
        return ModelResult(
            data=parsed,
            confidence=confidence,
            raw=text,
            provider_used=self.provider_name(model),
            mocked=False,
        )

    # --------------------------------------------------------------- helpers

    def provider_name(self, model: str | None = None) -> str:
        """Trace label for this provider, e.g. ``groq:openai/gpt-oss-120b``."""
        return f"groq:{model or self.model}"

    @property
    def client(self) -> Any:
        """The async Groq client, built lazily so importing never needs a key."""
        if self._client is None:
            if _groq is None:  # pragma: no cover - dependency is declared
                raise ModelFailure("The groq package is not installed.")
            self._client = _groq.AsyncGroq(api_key=self._api_key)
        return self._client

    def wants_json(self, prompt_config: dict[str, Any]) -> bool:
        """True when the block declares a structured answer is expected."""
        return _wants_json(prompt_config)

    def build_messages(
        self, prompt_config: dict[str, Any], data: Any
    ) -> list[dict[str, str]]:
        """Compose the chat messages: system rules, instruction, format, data.

        The current workflow data is always serialised as JSON in the user turn,
        so a block sees exactly what the previous step produced.
        """
        return _build_messages(prompt_config, data)

    async def _create(self, request: dict[str, Any], model: str) -> Any:
        """Call the client under our own timeout, mapping errors to engine errors.

        ``request`` always carries ``max_completion_tokens`` (see :meth:`call`), so
        the generation is capped even though the cap is passed through the splat.
        """
        try:
            return await asyncio.wait_for(
                # nosemgrep: ai.ai-best-practices.openai-missing-moderation.openai-missing-moderation.openai-missing-moderation -- Groq exposes no moderation endpoint; prompts are puzzle-authored, never end-user text
                self.client.chat.completions.create(**request),  # nosemgrep: ai.ai-best-practices.openai-missing-user-parameter.openai-missing-user-parameter-python.openai-missing-user-parameter-python, ai.ai-best-practices.openai-missing-max-tokens.openai-missing-max-tokens-python.openai-missing-max-tokens-python -- no tenant identity in a single-user local demo; output IS capped, via max_completion_tokens (groq's current name for max_tokens) set in call()
                self.timeout_s,
            )
        except TimeoutError as exc:
            raise StepTimeout(
                f"The Groq request took longer than {self.timeout_s:g}s.",
                detail={"provider": self.provider_name(model), "timeout_s": self.timeout_s},
            ) from exc
        except _timeout_types() as exc:  # groq's own timeout
            raise StepTimeout(
                "Groq timed out while answering.",
                detail={"provider": self.provider_name(model), "error": str(exc)},
            ) from exc
        except ModelFailure:
            raise
        except Exception as exc:
            raise ModelFailure(
                f"Groq could not answer: {exc}" if str(exc) else "Groq could not answer.",
                detail={
                    "provider": self.provider_name(model),
                    "error_type": type(exc).__name__,
                },
            ) from exc

    def _parse(
        self, text: str, wants_json: bool, model: str
    ) -> tuple[Any, float | None]:
        """Parse the completion text; raise :class:`InvalidOutputError` if unusable."""
        if not wants_json:
            return text, None
        try:
            parsed = json.loads(_strip_fence(text))
        except (ValueError, TypeError) as exc:
            raise InvalidOutputError(
                "The model did not return valid JSON.",
                detail={
                    "provider": self.provider_name(model),
                    "raw": text,
                    "parse_error": str(exc),
                },
            ) from exc
        return parsed, _confidence_of(parsed)


# --------------------------------------------------------------------- module


def _extract_text(completion: Any, model: str) -> str:
    """Pull the assistant message out of a completion (object or dict shaped)."""
    return extract_message_text(
        completion, provider_label=f"groq:{model}", brand="Groq"
    )
