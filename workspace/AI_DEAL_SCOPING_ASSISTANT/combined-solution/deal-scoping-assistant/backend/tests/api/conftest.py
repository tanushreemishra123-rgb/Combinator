"""Fixtures for the end-to-end API tests: a temporary seeds tree and a started session."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.sessions.scenarios import get_scenarios_dir
from tests.api.journey import Journey, build_seeds, start


@pytest.fixture(scope="session")
def seeds_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return build_seeds(tmp_path_factory.mktemp("seeds"))


@pytest.fixture
def seeded_client(seeds_dir: Path) -> Iterator[TestClient]:
    """A client whose scenarios come from the temporary seeds tree."""
    app.dependency_overrides[get_scenarios_dir] = lambda: seeds_dir
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def journey(seeded_client: TestClient) -> Journey:
    """A session from the seeded scenario: analyzed, priced and approved."""
    return start(seeded_client)
