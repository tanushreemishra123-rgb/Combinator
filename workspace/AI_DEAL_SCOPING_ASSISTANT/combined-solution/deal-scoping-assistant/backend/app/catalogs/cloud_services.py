"""Cloud service catalogs; the architecture stage may only use services listed here."""

import json
from functools import lru_cache

from pydantic import Field

from app.catalogs.paths import CATALOGS_DIR
from app.core.errors import NotFound
from app.domain.artifacts import ArchitectureArea
from app.domain.base import DomainModel
from app.domain.scope import CloudPlatform


class CatalogService(DomainModel):
    name: str = Field(description="Exact service name as the provider writes it.")
    category: str = Field(description="Provider category, for example compute or database.")
    areas: list[ArchitectureArea] = Field(
        default_factory=list, description="Architecture areas the service can serve."
    )
    description: str = Field(default="", description="What the service is used for.")


class CloudCatalog(DomainModel):
    platform: CloudPlatform = Field(description="Platform the catalog belongs to.")
    display_name: str = Field(description="Human-readable platform name.")
    services: list[CatalogService] = Field(default_factory=list, description="Allowed services.")

    def service_names(self) -> set[str]:
        return {service.name for service in self.services}

    def services_for_area(self, area: ArchitectureArea) -> list[CatalogService]:
        return [service for service in self.services if area in service.areas]


@lru_cache
def load_cloud_catalog(platform: CloudPlatform) -> CloudCatalog:
    """Read and cache one platform catalog."""
    path = CATALOGS_DIR / f"{platform.value}.json"
    if not path.is_file():
        raise NotFound(f"no service catalog for platform {platform.value}")
    return CloudCatalog.model_validate(json.loads(path.read_text(encoding="utf-8")))
