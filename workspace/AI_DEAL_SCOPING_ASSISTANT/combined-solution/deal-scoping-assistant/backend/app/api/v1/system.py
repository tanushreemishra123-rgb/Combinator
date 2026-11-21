"""Health and system-status endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field

from app.ai.provider import resolve_ai_runtime
from app.core.config import AiMode, Settings, get_settings
from app.domain.base import DomainModel

router = APIRouter(tags=["system"])


class Health(DomainModel):
    status: str = Field(description="ok when the API is up.")


class SystemInfo(DomainModel):
    ai_mode: AiMode = Field(description="Effective AI mode: mock or live.")
    provider: str = Field(description="Configured provider name; empty when not configured.")
    model: str = Field(description="Configured model id; empty when not configured.")
    live_available: bool = Field(description="True when live mode has provider, model and key.")
    fallback_reason: str = Field(description="Why live mode is unavailable, when it is.")


@router.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


@router.get("/system", response_model=SystemInfo)
def system(settings: Annotated[Settings, Depends(get_settings)]) -> SystemInfo:
    """One source of truth: the same validation the generation layer runs."""
    runtime = resolve_ai_runtime(settings)
    return SystemInfo(
        ai_mode=runtime.mode,
        provider=runtime.provider.value if runtime.provider else "",
        model=runtime.model,
        live_available=runtime.live_available,
        fallback_reason=runtime.fallback_reason,
    )
