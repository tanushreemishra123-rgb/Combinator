"""S5: the cloud-specific solution architecture.

The model never picks the platform and never sees another platform's services: the
selected catalog is the allowed service list, and the platform is filled in by code.
"""

from functools import partial
from typing import Any

from pydantic import Field

from app.ai.context import GenerationContext
from app.ai.runner import StageRequest
from app.ai.stages.base import as_json, config_view, elements_view, items_view, load_prompt
from app.ai.validators.architecture_areas import applicable_areas, check_architecture_areas
from app.ai.validators.asm_justification import check_asm_justification
from app.ai.validators.cloud_catalog import check_cloud_catalog
from app.ai.validators.id_references import check_id_references
from app.catalogs.cloud_services import CloudCatalog, load_cloud_catalog
from app.domain.artifacts import (
    Architecture,
    ArchitectureComponent,
    ArtifactKind,
    Environments,
    Flow,
    NarrativeSection,
    PlatformRecommendation,
)
from app.domain.base import DomainModel
from app.domain.scope import CloudPlatform

STAGE = "architecture"


class ArchitectureDraft(DomainModel):
    """Everything the model produces; the platform is added by the application."""

    components: list[ArchitectureComponent] = Field(
        default_factory=list, description="Architecture components grouped by area."
    )
    flows: list[Flow] = Field(default_factory=list, description="Flows between components.")
    environments: Environments = Field(description="Dev, test and production environments.")
    deployment_runtime: NarrativeSection = Field(description="Deployment and runtime approach.")
    availability_scalability: NarrativeSection = Field(description="Availability and scalability.")
    backup_dr: NarrativeSection = Field(description="Backup and disaster recovery.")
    observability: NarrativeSection = Field(description="Observability and monitoring.")
    security_controls: NarrativeSection = Field(description="Security controls.")


def allowed_services_view(catalog: CloudCatalog) -> list[dict[str, Any]]:
    """Name and areas only: the whole catalog must fit in the prompt token budget."""
    return [
        {"name": service.name, "areas": [area.value for area in service.areas]}
        for service in catalog.services
    ]


def components_view(components: list[ArchitectureComponent]) -> list[dict[str, Any]]:
    return [
        {
            "id": component.id,
            "name": component.name,
            "area": component.area.value,
            "cloud_service": component.cloud_service,
        }
        for component in components
    ]


def build(ctx: GenerationContext, platform: CloudPlatform) -> StageRequest[ArchitectureDraft]:
    catalog = load_cloud_catalog(platform)
    functional_scope = ctx.artifact(ArtifactKind.FUNCTIONAL_SCOPE)
    previous = ctx.artifact(ArtifactKind.ARCHITECTURE)
    items = ctx.active_items()
    user = as_json(
        {
            "customer": ctx.customer_name,
            "platform": platform.value,
            "platform_display_name": catalog.display_name,
            "config": config_view(ctx.config),
            "scope_items": items_view(items),
            "capabilities": elements_view(
                functional_scope.get("capabilities", []),
                ("id", "name", "description", "included_req_ids", "priority"),
            ),
            "previous_components": elements_view(
                previous.get("components", []), ("id", "name", "area")
            ),
            "allowed_services": allowed_services_view(catalog),
        }
    )
    return StageRequest(
        stage=ctx.stage_key(STAGE),
        schema=ArchitectureDraft,
        system=load_prompt(STAGE),
        user=user,
        validators=[
            partial(check_id_references, known_ids=ctx.known_ids(), level=ctx.reference_level()),
            partial(check_cloud_catalog, catalog=catalog),
            partial(check_asm_justification, items=items),
            partial(check_architecture_areas, expected=applicable_areas(items)),
        ],
    )


def to_architecture(
    draft: ArchitectureDraft,
    platform: CloudPlatform,
    recommendation: PlatformRecommendation | None = None,
) -> Architecture:
    """Wrap the draft into the stored artifact; the platform comes from the session."""
    return Architecture(
        platform=platform,
        platform_recommendation=recommendation,
        **draft.model_dump(),
    )
