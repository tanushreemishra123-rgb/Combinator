"""Provider wiring and mode reporting.

Responsibility: decide - from the environment alone - which live provider (if
any) the app runs with, build the matching :class:`~app.engine.ports.ModelPort`,
and describe that choice to the API/UI.

Two live providers are supported, both optional: **Groq** and **Google Gemini**.
The rule is deliberately boring:

* ``LLM_PROVIDER`` names the primary when that provider's key is present;
* otherwise the first configured provider in the order ``groq -> gemini``;
* nothing configured (or ``PUZZLE_FORCE_MOCK=1``) -> deterministic mock mode.

Every *other* configured provider is handed to the
:class:`~app.providers.resilient.ResilientModelProvider` as a named alternate, so
a Fallback block can ask for it by name.

``.env`` is loaded at *application startup* (see ``app.main``), never at import
time, so tests and tooling can control the environment themselves.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.engine.ports import ModelPort
from app.providers.groq import DEFAULT_MODEL, DEFAULT_TIMEOUT_S, GroqModelProvider
from app.providers.mock import MockModelProvider
from app.providers.openai_compat import GEMINI_DEFAULT_MODEL, gemini_provider
from app.providers.resilient import ResilientModelProvider

#: ``.../backend`` - the directory that owns ``.env`` / ``.env.example``.
BACKEND_DIR = Path(__file__).resolve().parents[2]

ENV_API_KEY = "GROQ_API_KEY"
ENV_MODEL = "GROQ_MODEL"
ENV_TIMEOUT = "GROQ_TIMEOUT_S"
ENV_FORCE_MOCK = "PUZZLE_FORCE_MOCK"
ENV_GEMINI_API_KEY = "GEMINI_API_KEY"
ENV_GEMINI_MODEL = "GEMINI_MODEL"
ENV_LLM_PROVIDER = "LLM_PROVIDER"

#: Every variable the provider layer reads, in the order they are documented.
ENV_KEYS = (
    ENV_API_KEY,
    ENV_MODEL,
    ENV_TIMEOUT,
    ENV_FORCE_MOCK,
    ENV_GEMINI_API_KEY,
    ENV_GEMINI_MODEL,
    ENV_LLM_PROVIDER,
)

#: Auto-selection order when ``LLM_PROVIDER`` is unset or names an unconfigured one.
PROVIDER_ORDER = ("groq", "gemini")

_TRUTHY = {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class ProviderSettings:
    """Everything the provider layer reads from the environment."""

    groq_api_key: str | None = None
    groq_model: str = DEFAULT_MODEL
    timeout_s: float = DEFAULT_TIMEOUT_S
    #: Set ``PUZZLE_FORCE_MOCK=1`` to pin mock mode even with a key present.
    force_mock: bool = False
    #: Canned mock responses, injected by the puzzle layer (Task 4).
    responses: dict[str, Any] = field(default_factory=dict)
    responses_by_provider: dict[str, dict[str, Any]] = field(default_factory=dict)
    gemini_api_key: str | None = None
    gemini_model: str = GEMINI_DEFAULT_MODEL
    #: ``LLM_PROVIDER``: an explicit primary choice, honoured when its key is set.
    llm_provider: str | None = None

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None, **overrides: Any) -> ProviderSettings:
        """Read settings from ``env`` (defaults to ``os.environ``)."""
        source = os.environ if env is None else env
        timeout_raw = (source.get(ENV_TIMEOUT) or "").strip()
        try:
            timeout_s = float(timeout_raw) if timeout_raw else DEFAULT_TIMEOUT_S
        except ValueError:
            timeout_s = DEFAULT_TIMEOUT_S

        def text(key: str) -> str:
            return (source.get(key) or "").strip()

        return cls(
            groq_api_key=text(ENV_API_KEY) or None,
            groq_model=text(ENV_MODEL) or DEFAULT_MODEL,
            timeout_s=timeout_s,
            force_mock=text(ENV_FORCE_MOCK).lower() in _TRUTHY,
            gemini_api_key=text(ENV_GEMINI_API_KEY) or None,
            gemini_model=text(ENV_GEMINI_MODEL) or GEMINI_DEFAULT_MODEL,
            llm_provider=text(ENV_LLM_PROVIDER).lower() or None,
            **overrides,
        )

    # ------------------------------------------------------------- selection

    @property
    def groq_configured(self) -> bool:
        """Whether a Groq key is present in the environment."""
        return bool(self.groq_api_key)

    @property
    def provider_keys(self) -> dict[str, bool]:
        """``{"groq": bool, "gemini": bool}`` - which keys are present."""
        return {
            "groq": bool(self.groq_api_key),
            "gemini": bool(self.gemini_api_key),
        }

    @property
    def configured_providers(self) -> tuple[str, ...]:
        """Configured live providers, in auto-selection order."""
        keys = self.provider_keys
        return tuple(name for name in PROVIDER_ORDER if keys[name])

    @property
    def primary_provider(self) -> str | None:
        """The provider that answers by default, or ``None`` for mock mode."""
        if self.force_mock:
            return None
        configured = self.configured_providers
        if not configured:
            return None
        # An explicit choice wins only if it is actually usable; otherwise we fall
        # through to the same order as if it had never been set.
        if self.llm_provider in configured:
            return self.llm_provider
        return configured[0]

    @property
    def live(self) -> bool:
        """Whether a live provider should be attempted at all."""
        return self.primary_provider is not None

    def model_for(self, provider: str) -> str:
        """The model id configured for one provider name."""
        return {
            "groq": self.groq_model,
            "gemini": self.gemini_model,
        }[provider]

    def label_for(self, provider: str) -> str:
        """Trace label for one provider name, e.g. ``gemini:gemini-2.5-flash``."""
        return f"{provider}:{self.model_for(provider)}"

    @property
    def provider_label(self) -> str:
        """Human/trace label for the active provider."""
        primary = self.primary_provider
        return self.label_for(primary) if primary else "mock"


def load_env(paths: list[Path] | None = None) -> list[str]:
    """Load ``.env`` files (backend first, then repo root). Call from startup.

    Existing environment variables always win, so an explicitly exported key or a
    test's monkeypatch is never overwritten. Returns the files actually loaded.
    """
    candidates = paths or [BACKEND_DIR / ".env", BACKEND_DIR.parent / ".env"]
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover - python-dotenv is a declared dependency
        return []
    # A set-but-empty variable (an exported GROQ_API_KEY="", a blank CI secret,
    # Docker forwarding an empty string) would otherwise shadow a real value in
    # ``.env`` - ``override=False`` treats "present but empty" as present.
    for key in ENV_KEYS:
        if key in os.environ and os.environ[key].strip() == "":
            del os.environ[key]
    loaded: list[str] = []
    for candidate in candidates:
        if candidate.is_file() and load_dotenv(candidate, override=False):
            loaded.append(str(candidate))
    return loaded


def build_live_provider(name: str, settings: ProviderSettings) -> ModelPort:
    """Build one configured live provider by name."""
    if name == "groq":
        return GroqModelProvider(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            timeout_s=settings.timeout_s,
        )
    if name == "gemini":
        return gemini_provider(
            settings.gemini_api_key, settings.gemini_model, settings.timeout_s
        )
    raise ValueError(f"Unknown provider: {name!r}")


def build_model_port(settings: ProviderSettings | None = None) -> ModelPort:
    """Build the model port for the current environment.

    Always returns a :class:`ResilientModelProvider`: with at least one key it
    wraps the chosen primary and silently degrades to the mock on an outage;
    without one it *is* the mock. Any other configured provider is attached as a
    named alternate a Fallback block can request.
    """
    settings = settings or ProviderSettings.from_env()
    mock = MockModelProvider(
        settings.responses,
        responses_by_provider=settings.responses_by_provider,
    )
    primary_name = settings.primary_provider
    if primary_name is None:
        return ResilientModelProvider(None, mock, primary_name="mock")

    primary = build_live_provider(primary_name, settings)
    alternates = {
        name: build_live_provider(name, settings)
        for name in settings.configured_providers
        if name != primary_name
    }
    return ResilientModelProvider(
        primary,
        mock,
        primary_name=settings.label_for(primary_name),
        alternates=alternates,
    )


def provider_status(settings: ProviderSettings | None = None) -> dict[str, Any]:
    """``{"mode", "provider", "groq_configured", "providers"}`` for ``/api/health``."""
    settings = settings or ProviderSettings.from_env()
    return {
        "mode": "live" if settings.live else "mock",
        "provider": settings.provider_label,
        "groq_configured": settings.groq_configured,
        "providers": settings.provider_keys,
    }
