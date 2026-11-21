"""Live-provider-with-automatic-mock-fallback.

Responsibility: make "the AI provider is unavailable" a non-event for the person
running a puzzle. The primary (Groq) is tried first; any real transport/API
failure is swallowed *once*, the same call is replayed against the deterministic
mock, and the answer comes back clearly labelled as mocked so the UI can show a
"mock mode" badge instead of an error.

What it deliberately does **not** rescue:

* **Injected failures.** The failure injector runs in the executor *before* any
  port is reached, so a staged ``model_error``/``timeout`` never touches this
  class - the guards (Retry / Fallback) recover it, which is the whole point of
  the puzzles.
* **Bad model output.** :class:`InvalidOutputError` propagates untouched: a live
  model returning malformed JSON is a workflow problem the Validator block is
  meant to catch, not an availability problem.
* **Explicit provider overrides.** When the Fallback block asks for a specific
  provider (``mock``, ``mock-backup``, ...) the call goes straight to the mock's
  table for that provider. When it names another *configured live* provider
  (``groq``, ``gemini``), the call goes to that provider instead - and
  if it, too, is unavailable, the same mock safety net catches it.
"""

from __future__ import annotations

from typing import Any

from app.engine.errors import InvalidOutputError, ModelFailure, StepTimeout
from app.engine.ports import ModelPort, ModelResult
from app.providers.mock import MockModelProvider

#: A ``provider`` override starting with this prefix always resolves to the mock.
MOCK_PROVIDER_PREFIX = "mock"


class ResilientModelProvider:
    """Wraps a primary :class:`ModelPort` with a deterministic mock safety net.

    Args:
        primary: the live provider, or ``None`` when no key is configured (the
            app is then simply *in* mock mode - nothing is a "fallback").
        mock: the deterministic provider used for overrides and rescues.
        primary_name: label used in trace strings, e.g. ``groq:llama-3.3-70b``.
        alternates: other configured live providers by name (``{"gemini": port}``),
            reachable through a Fallback block's ``provider`` override. An
            override that names nothing here still resolves to the mock, which is
            what keeps an unknown or unconfigured name harmless.

    Note on labelling: :class:`~app.engine.ports.ModelResult` has no ``meta``
    field, so an auto-fallback is reported through ``provider_used``
    (``"mock (auto-fallback from groq:...)"``) plus ``mocked=True``, both of
    which the AI Model block already copies into the step's trace payload. The
    structured reason is also kept on the instance as :attr:`last_fallback` for
    the mode/health endpoint.
    """

    def __init__(
        self,
        primary: ModelPort | None = None,
        mock: MockModelProvider | None = None,
        *,
        primary_name: str = "groq",
        alternates: dict[str, ModelPort] | None = None,
    ) -> None:
        self.primary = primary
        self.mock = mock or MockModelProvider()
        self.primary_name = primary_name
        self.alternates: dict[str, ModelPort] = dict(alternates or {})
        self.fallback_count = 0
        self.last_fallback: dict[str, Any] | None = None

    # ------------------------------------------------------------------ port

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult:
        """Try the requested (or primary) live provider, fall back to the mock."""
        if self.primary is None or is_mock_provider(provider):
            return await self.mock.call(prompt_config, data, provider)

        target, target_name = self._route(provider)
        try:
            return await target.call(prompt_config, data, provider)
        except InvalidOutputError:
            # Bad output is a workflow concern (validators/retry), not an outage.
            raise
        except (ModelFailure, StepTimeout) as exc:
            reason = {"kind": exc.kind, "message": str(exc)}
        except Exception as exc:  # noqa: BLE001 - an unexpected client bug is still an outage
            reason = {"kind": "model_error", "message": str(exc) or type(exc).__name__}

        return await self._fallback(prompt_config, data, reason, target_name)

    # --------------------------------------------------------------- helpers

    def _route(self, provider: str | None) -> tuple[ModelPort, str]:
        """Which live provider answers this call, and under which trace label.

        A ``provider`` override naming one of the configured alternates picks it;
        anything else (including an unknown name) stays on the primary.
        """
        if self.primary is None:  # guarded by the caller
            raise ModelFailure("No live model provider is configured.")
        alternate = self.alternates.get((provider or "").strip().lower())
        if alternate is None:
            return self.primary, self.primary_name
        return alternate, provider_label(alternate, str(provider).strip().lower())

    @property
    def mode(self) -> str:
        """``"live"`` while a primary is configured, else ``"mock"``."""
        return "live" if self.primary is not None else "mock"

    def status(self) -> dict[str, Any]:
        """Runtime view of this provider for the mode/health endpoint."""
        return {
            "mode": self.mode,
            "primary": self.primary_name if self.primary is not None else None,
            "alternates": sorted(self.alternates),
            "auto_fallbacks": self.fallback_count,
            "last_fallback": self.last_fallback,
        }

    async def _fallback(
        self,
        prompt_config: dict[str, Any],
        data: Any,
        reason: dict[str, Any],
        source: str | None = None,
    ) -> ModelResult:
        """Replay the call against the mock and label the answer as auto-fallback."""
        source = source or self.primary_name
        self.fallback_count += 1
        self.last_fallback = {"from": source, **reason}
        result = await self.mock.call(prompt_config, data, None)
        return result.model_copy(
            update={
                "mocked": True,
                "provider_used": f"mock (auto-fallback from {source})",
            }
        )


def is_mock_provider(provider: str | None) -> bool:
    """Whether a requested provider name names the mock (``mock``, ``mock-backup``)."""
    return bool(provider) and str(provider).strip().lower().startswith(
        MOCK_PROVIDER_PREFIX
    )


def provider_label(port: ModelPort, fallback: str) -> str:
    """A port's own trace label (``gemini:gemini-2.5-flash``) if it publishes one."""
    naming = getattr(port, "provider_name", None)
    if callable(naming):
        try:
            return str(naming())
        except Exception:  # noqa: BLE001 - labelling must never break a call
            return fallback
    return fallback
