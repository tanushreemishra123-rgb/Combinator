"""Catalog loaders read the seeded files and are cached."""

from app.catalogs.cloud_services import load_cloud_catalog
from app.catalogs.frameworks import load_frameworks
from app.domain.artifacts import ArchitectureArea
from app.domain.scope import CloudPlatform


def test_every_platform_catalog_loads() -> None:
    for platform in CloudPlatform:
        catalog = load_cloud_catalog(platform)
        assert catalog.platform is platform
        assert len(catalog.services) > 20
        assert catalog.display_name


def test_catalog_is_cached() -> None:
    assert load_cloud_catalog(CloudPlatform.AWS) is load_cloud_catalog(CloudPlatform.AWS)


def test_services_can_be_filtered_by_area() -> None:
    catalog = load_cloud_catalog(CloudPlatform.GCP)
    databases = catalog.services_for_area(ArchitectureArea.DATABASES_AND_STORAGE)
    assert databases
    assert all(ArchitectureArea.DATABASES_AND_STORAGE in service.areas for service in databases)
    assert catalog.service_names() >= {service.name for service in databases}


def test_frameworks_load_with_their_notes() -> None:
    frameworks = load_frameworks().frameworks
    names = {framework.name for framework in frameworks}
    assert {"LangChain", "LangGraph", "Semantic Kernel"} <= names
    assert all(framework.notes for framework in frameworks)
