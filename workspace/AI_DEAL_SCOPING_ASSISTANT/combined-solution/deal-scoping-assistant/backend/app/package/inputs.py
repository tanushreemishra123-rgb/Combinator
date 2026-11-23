"""Inputs the package builder takes: the generated artifacts and the file naming data."""

from dataclasses import dataclass
from typing import Any

from app.domain.artifacts import (
    CONTENT_MODEL_BY_KIND,
    AiStrategy,
    Architecture,
    ArtifactEnvelope,
    ArtifactKind,
    DataStrategy,
    EstimateDrivers,
    ExecutiveSummary,
    FunctionalScope,
    IntegrationArchitecture,
    Prd,
)
from app.domain.scope import SessionRead

# Artifact kinds the package renders; `estimate` is passed separately as a domain object.
_FIELD_BY_KIND: dict[ArtifactKind, str] = {
    ArtifactKind.PRD: "prd",
    ArtifactKind.FUNCTIONAL_SCOPE: "functional_scope",
    ArtifactKind.ARCHITECTURE: "architecture",
    ArtifactKind.DATA_STRATEGY: "data_strategy",
    ArtifactKind.INTEGRATION_ARCHITECTURE: "integration_architecture",
    ArtifactKind.AI_STRATEGY: "ai_strategy",
    ArtifactKind.ESTIMATE_DRIVERS: "estimate_drivers",
    ArtifactKind.EXECUTIVE_SUMMARY: "executive_summary",
}


@dataclass(frozen=True)
class PackageArtifacts:
    """Every artifact is optional: a partial session still exports a package."""

    executive_summary: ExecutiveSummary | None = None
    prd: Prd | None = None
    functional_scope: FunctionalScope | None = None
    architecture: Architecture | None = None
    data_strategy: DataStrategy | None = None
    integration_architecture: IntegrationArchitecture | None = None
    ai_strategy: AiStrategy | None = None
    estimate_drivers: EstimateDrivers | None = None
    generated_by: str = ""
    """How the artifacts were produced, e.g. mock:recorded or live:<provider>/<model>."""

    @classmethod
    def from_envelopes(cls, envelopes: list[ArtifactEnvelope]) -> "PackageArtifacts":
        """Parse stored artifact content into typed models; unknown kinds are ignored."""
        parsed: dict[str, Any] = {}
        for envelope in envelopes:
            field = _FIELD_BY_KIND.get(envelope.kind)
            if field is None:
                continue
            model = CONTENT_MODEL_BY_KIND[envelope.kind]
            parsed[field] = model.model_validate(envelope.content)
            if envelope.generated_by:
                parsed["generated_by"] = envelope.generated_by
        return cls(**parsed)


@dataclass(frozen=True)
class PackageMeta:
    """What the export filename is built from."""

    customer_name: str
    scope_version: int

    @classmethod
    def from_session(cls, session: SessionRead) -> "PackageMeta":
        return cls(
            customer_name=session.customer_name or session.name,
            scope_version=session.scope_version,
        )
