"""Write the JSON schema of every structured output model to seeds/schemas/.

Run from `backend/`: uv run python -m scripts.export_schemas
"""

import json
from pathlib import Path

from pydantic import BaseModel

from app.domain.artifacts import (
    AiStrategy,
    Architecture,
    ArtifactEnvelope,
    DataStrategy,
    EstimateDrivers,
    ExecutiveSummary,
    FunctionalScope,
    IntegrationArchitecture,
    PlatformRecommendation,
    Prd,
)
from app.domain.changes import ChangeRecord, ChangeRequest
from app.domain.estimation import Estimate, EstimationConfig, RateCard
from app.domain.package import DocumentModel
from app.domain.quality import QualityReport
from app.domain.scope import ScopeItem, SessionConfig, SourceDocument

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "seeds" / "schemas"

MODELS: dict[str, type[BaseModel]] = {
    "scope_item": ScopeItem,
    "source_document": SourceDocument,
    "session_config": SessionConfig,
    "prd": Prd,
    "functional_scope": FunctionalScope,
    "platform_recommendation": PlatformRecommendation,
    "architecture": Architecture,
    "data_strategy": DataStrategy,
    "integration_architecture": IntegrationArchitecture,
    "ai_strategy": AiStrategy,
    "estimate_drivers": EstimateDrivers,
    "artifact_envelope": ArtifactEnvelope,
    "executive_summary": ExecutiveSummary,
    "rate_card": RateCard,
    "estimation_config": EstimationConfig,
    "estimate": Estimate,
    "quality_report": QualityReport,
    "change_request": ChangeRequest,
    "change_record": ChangeRecord,
    "document_model": DocumentModel,
}


def export(output_dir: Path = OUTPUT_DIR) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, model in MODELS.items():
        path = output_dir / f"{name}.schema.json"
        path.write_text(json.dumps(model.model_json_schema(), indent=2) + "\n", encoding="utf-8")
        written.append(path)
    return written


if __name__ == "__main__":
    for path in export():
        print(f"wrote {path}")
