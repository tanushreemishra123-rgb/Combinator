"""AI framework notes handed to the AI-strategy stage so recommendations stay concrete."""

import json
from functools import lru_cache

from pydantic import Field

from app.catalogs.paths import CATALOGS_DIR
from app.core.errors import NotFound
from app.domain.base import DomainModel


class Framework(DomainModel):
    name: str = Field(description="Framework or managed service name.")
    language_ecosystems: list[str] = Field(
        default_factory=list, description="Languages the framework targets."
    )
    best_for: list[str] = Field(default_factory=list, description="Where it fits well.")
    avoid_when: list[str] = Field(default_factory=list, description="Where it does not fit.")
    notes: str = Field(default="", description="Short factual note about the framework.")


class FrameworkCatalog(DomainModel):
    frameworks: list[Framework] = Field(default_factory=list, description="Known frameworks.")


@lru_cache
def load_frameworks() -> FrameworkCatalog:
    """Read and cache the framework catalog."""
    path = CATALOGS_DIR / "frameworks.json"
    if not path.is_file():
        raise NotFound("framework catalog is missing")
    return FrameworkCatalog.model_validate(json.loads(path.read_text(encoding="utf-8")))
