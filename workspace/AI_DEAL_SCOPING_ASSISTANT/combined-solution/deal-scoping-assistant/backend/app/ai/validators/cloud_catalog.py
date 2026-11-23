"""Hard rule: every cloud service must exist in the selected platform's catalog."""

from typing import Any

from app.ai.findings import Finding, error
from app.catalogs.cloud_services import CloudCatalog

_SUGGESTIONS = 6


def check_cloud_catalog(architecture: Any, catalog: CloudCatalog) -> list[Finding]:
    """Reject services the platform does not offer; fix pure spelling case in place."""
    by_lower = {service.name.lower(): service.name for service in catalog.services}
    findings: list[Finding] = []
    for component in architecture.components:
        name = component.cloud_service.strip()
        if name in by_lower.values():
            continue
        matched = by_lower.get(name.lower())
        if matched:
            component.cloud_service = matched  # same service, different capitalisation
            continue
        options = [service.name for service in catalog.services_for_area(component.area)]
        suggestions = ", ".join(options[:_SUGGESTIONS]) or ", ".join(
            service.name for service in catalog.services[:_SUGGESTIONS]
        )
        findings.append(
            error(
                f"{component.id}: '{component.cloud_service}' is not a "
                f"{catalog.display_name} service in the allowed catalog. "
                f"Use one of: {suggestions}",
                [component.id],
            )
        )
    return findings
