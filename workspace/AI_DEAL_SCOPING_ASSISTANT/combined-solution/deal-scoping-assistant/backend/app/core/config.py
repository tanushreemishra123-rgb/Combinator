"""Single place where environment configuration is read."""

from enum import StrEnum
from functools import lru_cache
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _default_cors_origins() -> list[str]:
    """Local dev server and the Docker frontend, so the app works without a .env file."""
    return ["http://localhost:5173", "http://localhost:8080"]


class AppEnv(StrEnum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TEST = "test"


class AiMode(StrEnum):
    MOCK = "mock"
    LIVE = "live"


class AiProvider(StrEnum):
    GOOGLE_GENAI = "google_genai"
    GROQ = "groq"
    OLLAMA = "ollama"


class Settings(BaseSettings):
    """Typed view of `.env`. Secrets stay `SecretStr` so they never reach logs or the API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: AppEnv = AppEnv.DEVELOPMENT
    log_level: str = "INFO"
    database_url: str = "sqlite:///./data/app.db"
    # NoDecode: the value is a comma-separated list, not JSON. Never a wildcard.
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=_default_cors_origins)
    max_upload_mb: int = 10
    max_input_chars: int = 60000

    ai_mode: AiMode = AiMode.MOCK
    ai_provider: AiProvider | None = None
    ai_model: str = ""
    ai_temperature: float = 0.2
    ai_timeout_seconds: int = 120
    ai_max_repair_attempts: int = 2
    # Optional limits for the live provider; empty means "use the provider's default".
    ai_max_output_tokens: int | None = 16384
    ai_reasoning_effort: str = ""
    # Sessions that did not come from a seeded scenario replay this scenario's mock answers.
    google_api_key: SecretStr = SecretStr("")
    groq_api_key: SecretStr = SecretStr("")
    ollama_base_url: str = "http://localhost:11434"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("ai_max_output_tokens", mode="before")
    @classmethod
    def _empty_limit_is_none(cls, value: object) -> object:
        # An empty AI_MAX_OUTPUT_TOKENS means the provider decides.
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("ai_provider", mode="before")
    @classmethod
    def _empty_provider_is_none(cls, value: object) -> object:
        # `.env.example` ships AI_PROVIDER empty; that means "not configured".
        if isinstance(value, str) and not value.strip():
            return None
        return value

    def provider_key(self) -> str:
        """Credential for the configured provider ('' when missing; Ollama needs a URL instead)."""
        if self.ai_provider is AiProvider.GOOGLE_GENAI:
            return self.google_api_key.get_secret_value()
        if self.ai_provider is AiProvider.GROQ:
            return self.groq_api_key.get_secret_value()
        if self.ai_provider is AiProvider.OLLAMA:
            return self.ollama_base_url
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
