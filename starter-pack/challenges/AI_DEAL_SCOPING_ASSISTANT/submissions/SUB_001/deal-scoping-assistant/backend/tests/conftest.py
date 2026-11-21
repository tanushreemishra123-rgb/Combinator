"""Test environment: a throwaway sqlite file, mock AI mode, no real keys."""

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

TMP_DIR = Path(tempfile.mkdtemp(prefix="tc101-tests-"))

# Set before app modules are imported; env always wins over backend/.env.
os.environ.update(
    {
        "APP_ENV": "test",
        "DATABASE_URL": f"sqlite:///{TMP_DIR / 'test.db'}",
        "CORS_ORIGINS": "http://localhost:5173,http://localhost:3000",
        "AI_MODE": "mock",
        "AI_PROVIDER": "",
        "AI_MODEL": "",
        "GOOGLE_API_KEY": "",
        "GROQ_API_KEY": "",
    }
)

from app.core.config import get_settings  # noqa: E402
from app.db.session import create_all, get_session_factory, reset_engine_cache  # noqa: E402

get_settings.cache_clear()
reset_engine_cache()


@pytest.fixture(scope="session", autouse=True)
def _schema() -> None:
    create_all()


@pytest.fixture
def db() -> Iterator[Session]:
    with get_session_factory()() as session:
        yield session
