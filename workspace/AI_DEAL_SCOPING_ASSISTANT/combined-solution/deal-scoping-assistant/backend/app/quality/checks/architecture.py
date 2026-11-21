"""Architecture and technology checks: QG_04 and QG_09."""

from app.domain.artifacts import ArtifactKind
from app.domain.quality import CheckId, CheckStatus, QualityCheckResult, Severity
from app.domain.scope import CloudPlatform, ItemType
from app.quality.checks.common import (
    QualityContext,
    approved_items,
    check_result,
    has_artifact,
    not_applicable,
    raw_list,
)
from app.traceability.coverage import is_scope_id, supporting_ids
from app.traceability.index import iter_elements, string_list

_PLATFORM_WORDS = {
    CloudPlatform.AWS: ("aws", "amazon web services"),
    CloudPlatform.AZURE: ("azure",),
    CloudPlatform.GCP: ("gcp", "google cloud"),
}


def qg_04_components_without_justification(ctx: QualityContext) -> QualityCheckResult:
    name = "Architecture components without requirement justification"
    if not has_artifact(ctx, ArtifactKind.ARCHITECTURE):
        return not_applicable(
            CheckId.QG_04, name, Severity.ERROR, "No architecture has been generated."
        )
    supported = supporting_ids(ctx.items)
    offenders: list[str] = []
    for element_id, element in iter_elements(ctx.contents, ArtifactKind.ARCHITECTURE, "components"):
        justification = [
            ref for ref in string_list(element.get("supported_ids")) if is_scope_id(ref)
        ]
        if not any(ref in supported for ref in justification):
            offenders.append(element_id)
    return check_result(
        CheckId.QG_04,
        name,
        Severity.ERROR,
        [", ".join(offenders)] if offenders else [],
        offenders,
        "Every architecture component names a requirement or assumption that justifies it.",
        "These components are not justified by an approved requirement or assumption:",
        "Add the requirement ids that justify the component, or remove it.",
        CheckStatus.FAILED,
    )


def qg_09_conflicting_technology(ctx: QualityContext) -> QualityCheckResult:
    name = "Conflicting cloud selection or technologies"
    platform = ctx.cloud_platform
    if platform is None:
        return not_applicable(
            CheckId.QG_09, name, Severity.ERROR, "No cloud platform has been selected yet."
        )
    catalog = (ctx.catalog_services or {}).get(platform.value, frozenset())
    off_catalog: list[str] = []
    for element_id, element in iter_elements(ctx.contents, ArtifactKind.ARCHITECTURE, "components"):
        service = str(element.get("cloud_service", "")).strip()
        if catalog and service and service not in catalog:
            off_catalog.append(f"{element_id} uses '{service}'")
    conflicting_tech: list[str] = []
    for item in approved_items(ctx, [ItemType.TECHNOLOGY_PREFERENCE]):
        text = f"{item.title} {item.description}".lower()
        for other, words in _PLATFORM_WORDS.items():
            if other is not platform and any(word in text for word in words):
                conflicting_tech.append(f"{item.id} prefers {other.value}")
    preference = ctx.config.ai_provider_preference
    provider_conflict: list[str] = []
    if preference is not None and preference.value not in ("none", "platform_native"):
        providers = " ".join(
            str(option.get("provider", "")).lower()
            for option in raw_list(ctx, ArtifactKind.AI_STRATEGY, "provider_options")
        )
        if providers and preference.value.replace("_", " ") not in providers:
            provider_conflict.append(
                f"the AI strategy offers no option from the preferred provider '{preference.value}'"
            )
    findings = [
        *(f"{entry} which is not in the {platform.value} catalog." for entry in off_catalog),
        *(f"{entry} while the solution targets {platform.value}." for entry in conflicting_tech),
        *(f"{entry}." for entry in provider_conflict),
    ]
    status = CheckStatus.FAILED if off_catalog else CheckStatus.WARNING
    return check_result(
        CheckId.QG_09,
        name,
        Severity.ERROR,
        findings,
        [entry.split(" ")[0] for entry in off_catalog + conflicting_tech],
        f"Services and technology preferences match the {platform.value} selection.",
        "Technology choices conflict:",
        "Map the component to a catalog service, or revisit the platform selection.",
        status,
    )
