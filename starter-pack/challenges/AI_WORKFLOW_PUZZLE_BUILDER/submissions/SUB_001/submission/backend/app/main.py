"""FastAPI application entrypoint for the AI Workflow Puzzle Builder backend."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api import ROUTERS
from app.api.context import RunRegistry
from app.providers import load_env, provider_status

ALLOWED_ORIGINS = ["http://localhost:5173"]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load ``.env`` and create the one run registry every request shares.

    ``.env`` is read here rather than at import time so tests and tooling stay in
    charge of their own environment. The registry owns the single in-memory run
    store; ``app.api.deps.get_registry`` builds one lazily for any transport that
    skips lifespan events.
    """
    app.state.env_files = load_env()
    app.state.runs = RunRegistry()
    yield


app = FastAPI(title="AI Workflow Puzzle Builder", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in ROUTERS:
    app.include_router(router)


class Health(BaseModel):
    """Service liveness plus the active model-provider mode."""

    status: str
    #: ``"live"`` when any live provider key is configured, otherwise ``"mock"``.
    mode: str
    #: Trace label of the active provider, e.g. ``groq:openai/gpt-oss-120b``.
    provider: str
    #: Kept for back-compat; ``providers["groq"]`` says the same thing.
    groq_configured: bool
    #: Which live providers have a key: ``{"groq", "gemini"} -> bool``.
    providers: dict[str, bool]


@app.get("/api/health")
async def health() -> Health:
    """Liveness plus the real provider mode the UI badges."""
    return Health(status="ok", **provider_status())
