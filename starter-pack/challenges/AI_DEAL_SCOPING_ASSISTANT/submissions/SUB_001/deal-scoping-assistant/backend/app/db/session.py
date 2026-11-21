"""Engine, session factory and the FastAPI database dependency."""

from collections.abc import Generator
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import ALL_MODELS  # noqa: F401  (import registers the tables)


def build_engine(database_url: str) -> Engine:
    url = make_url(database_url)
    if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(database_url, future=True)
    if url.drivername.startswith("sqlite"):
        _enable_sqlite_foreign_keys(engine)
    return engine


def _set_sqlite_pragma(dbapi_connection: Any, _: Any) -> None:
    # SQLite ignores ON DELETE CASCADE unless foreign keys are switched on per connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _enable_sqlite_foreign_keys(engine: Engine) -> None:
    event.listen(engine, "connect", _set_sqlite_pragma)


@lru_cache
def get_engine() -> Engine:
    return build_engine(get_settings().database_url)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def create_all() -> None:
    Base.metadata.create_all(get_engine())


def get_db() -> Generator[Session, None, None]:
    with get_session_factory()() as session:
        yield session


def reset_engine_cache() -> None:
    """Drop cached engine/session factory so a new DATABASE_URL takes effect (used by tests)."""
    get_engine.cache_clear()
    get_session_factory.cache_clear()
