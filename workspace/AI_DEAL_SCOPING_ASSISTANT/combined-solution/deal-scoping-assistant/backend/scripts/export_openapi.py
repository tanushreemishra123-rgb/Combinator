"""Write the OpenAPI document to backend/openapi.json.

The frontend generates its types from this file, so it is committed and refreshed
whenever the API changes. Run from `backend/`: uv run python -m scripts.export_openapi
"""

import json
from pathlib import Path
from typing import Any, Literal

from pydantic.json_schema import models_json_schema

from app.domain.artifacts import CONTENT_MODEL_BY_KIND
from app.main import app

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def build_document() -> dict[str, Any]:
    """The API document plus the artifact content models.

    An artifact's `content` is a free object in the API (its shape depends on the kind),
    so FastAPI does not list those models. They are added here so the frontend types for
    PRD, architecture and the other artifacts are generated, never copied by hand.
    """
    document = app.openapi()
    mode: Literal["serialization"] = "serialization"
    models = [(model, mode) for model in CONTENT_MODEL_BY_KIND.values()]
    _, definitions = models_json_schema(models, ref_template="#/components/schemas/{model}")
    schemas = document.setdefault("components", {}).setdefault("schemas", {})
    for name, schema in definitions.get("$defs", {}).items():
        schemas.setdefault(name, schema)
    return document


def export(path: Path = OUTPUT_PATH) -> Path:
    path.write_text(json.dumps(build_document(), indent=2) + "\n", encoding="utf-8")
    return path


if __name__ == "__main__":
    print(f"wrote {export()}")
