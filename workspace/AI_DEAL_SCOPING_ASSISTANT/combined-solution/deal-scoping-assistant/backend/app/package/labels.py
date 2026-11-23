"""Human-readable labels for enum values, shared by the builder and the renderers."""

from datetime import UTC, datetime

from app.domain.artifacts import ArchitectureArea, Basis, Element

AREA_TITLES: dict[ArchitectureArea, str] = {
    ArchitectureArea.USER_FACING_APPLICATIONS: "User-facing applications",
    ArchitectureArea.BACKEND_SERVICES: "Backend services",
    ArchitectureArea.APIS: "APIs",
    ArchitectureArea.DATABASES_AND_STORAGE: "Databases and storage",
    ArchitectureArea.IDENTITY_AND_ACCESS_MANAGEMENT: "Identity and access management",
    ArchitectureArea.MESSAGING_AND_EVENT_PROCESSING: "Messaging and event processing",
    ArchitectureArea.INTEGRATION_COMPONENTS: "Integration components",
    ArchitectureArea.AI_AND_ML_SERVICES: "AI and ML services",
    ArchitectureArea.OBSERVABILITY_AND_MONITORING: "Observability and monitoring",
    ArchitectureArea.SECURITY_CONTROLS: "Security controls",
    ArchitectureArea.DEPLOYMENT_AND_RUNTIME: "Deployment and runtime",
    ArchitectureArea.ENVIRONMENTS_DEV_TEST_PROD: "Environments (dev, test, prod)",
    ArchitectureArea.AVAILABILITY_AND_SCALABILITY: "Availability and scalability",
    ArchitectureArea.BACKUP_AND_DISASTER_RECOVERY: "Backup and disaster recovery",
}

BASIS_TITLES: dict[Basis, str] = {
    Basis.CUSTOMER: "Customer",
    Basis.INFERRED: "Inferred",
    Basis.ASSUMED: "Assumed",
    Basis.RECOMMENDED: "Recommended",
}

NEEDS_VALIDATION = "Needs validation"


def area_title(area: ArchitectureArea) -> str:
    return AREA_TITLES.get(area, area.value.replace("_", " ").capitalize())


def basis_title(basis: Basis) -> str:
    return BASIS_TITLES[basis]


def grounding(element: Element) -> str:
    """The provenance suffix the spec requires on every generated statement."""
    req_ids = ", ".join(element.req_ids) if element.req_ids else "none"
    parts = [f"Reqs: {req_ids}", f"Basis: {basis_title(element.basis)}"]
    if element.validation_required:
        reason = element.validation_reason.strip()
        parts.append(f"{NEEDS_VALIDATION}: {reason}" if reason else NEEDS_VALIDATION)
    return "[" + "; ".join(parts) + "]"


def with_grounding(text: str, element: Element) -> str:
    return f"{text.strip()} {grounding(element)}".strip()


# Exact wording for values whose plain de-underscoring would read badly.
_LABEL_OVERRIDES = {
    "customer_stated": "Customer-stated",
    "ai_inferred": "AI-inferred",
    "aws": "Amazon Web Services",
    "azure": "Microsoft Azure",
    "gcp": "Google Cloud Platform",
    "any": "Any platform",
    "ai_and_ml_services": "AI and ML services",
    "ai_use_case": "AI use case",
    "human_decision": "Human decision",
    "not_applicable": "Not applicable",
    "very_high": "Very high",
    "dev": "Development",
    "prod": "Production",
    "role_mix": "Role mix",
    "topcoder_challenges": "Topcoder challenges",
}

_ACRONYMS = {"ai": "AI", "api": "API", "apis": "APIs", "ml": "ML", "prd": "PRD", "rom": "ROM"}


def humanise(value: object) -> str:
    """Turn an enum value or snake_case key into prose; no raw enum reaches the reader."""
    raw = str(getattr(value, "value", value)).strip()
    if not raw:
        return ""
    if raw in _LABEL_OVERRIDES:
        return _LABEL_OVERRIDES[raw]
    words = [_ACRONYMS.get(word.lower(), word) for word in raw.replace("_", " ").split()]
    if not words:
        return ""
    first = words[0]
    return " ".join([first[:1].upper() + first[1:], *words[1:]])


def ai_mode_title(ai_mode: str, generated_by: str = "") -> str:
    """Mock or live, with the provider and model when an artifact recorded them."""
    if generated_by.startswith("live:"):
        return f"Live ({generated_by.removeprefix('live:')})"
    if ai_mode.strip().lower().startswith("live"):
        return "Live"
    return "Mock (recorded responses)"


def format_timestamp(moment: datetime) -> str:
    """One readable timestamp shared by every renderer, e.g. 17 Sep 2026, 16:22 UTC."""
    return moment.astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")
