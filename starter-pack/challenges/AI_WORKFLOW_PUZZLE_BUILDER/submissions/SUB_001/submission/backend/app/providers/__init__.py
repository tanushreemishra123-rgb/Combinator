"""Model providers: the live ones (Groq, Google Gemini), the deterministic
Mock provider, and the automatic live-to-mock fallback that keeps every puzzle
runnable without a key."""

from app.providers.factory import (
    PROVIDER_ORDER,
    ProviderSettings,
    build_model_port,
    load_env,
    provider_status,
)
from app.providers.groq import DEFAULT_MODEL, GroqModelProvider
from app.providers.mock import MockModelProvider, prompt_id_for
from app.providers.openai_compat import GEMINI_DEFAULT_MODEL, OpenAICompatProvider
from app.providers.resilient import ResilientModelProvider

__all__ = [
    "DEFAULT_MODEL",
    "GEMINI_DEFAULT_MODEL",
    "PROVIDER_ORDER",
    "GroqModelProvider",
    "MockModelProvider",
    "OpenAICompatProvider",
    "ProviderSettings",
    "ResilientModelProvider",
    "build_model_port",
    "load_env",
    "prompt_id_for",
    "provider_status",
]
