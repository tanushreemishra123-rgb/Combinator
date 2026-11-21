"""Reusable end-to-end helper: a temporary seeds tree plus one session to drive."""

import json
import shutil
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

from docx import Document
from fastapi.testclient import TestClient
from pypdf import PdfReader

from tests.unit.ai.conftest import REQUIREMENTS_TEXT

SLUG = "demo"
MOCK_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "ai" / "scenarios" / SLUG
CONTEXT = {
    "slug": SLUG,
    "title": "Shipment tracking portal",
    "scenario_type": "portal",
    "customer_name": "Northwind Logistics",
    "industry": "logistics",
    "opportunity_summary": "A portal that shows customers where their shipment is.",
    "requested_by": "Head of Customer Service",
    "preferred_cloud": None,
    "expected_users": None,
    "target_regions": ["eu-west"],
    "delivery_deadline": None,
    "regulatory_constraints": [],
    "demo_change": {
        "description": "The customer states the expected user volume.",
        "config_key": "expected_users",
        "from": None,
        "to": 5000,
    },
}


def build_seeds(root: Path) -> Path:
    """A scenarios directory holding the demo scenario and its recorded answers."""
    scenario = root / "scenarios" / SLUG
    shutil.copytree(MOCK_FIXTURES / "mock", scenario / "mock")
    (scenario / "requirements.md").write_text(REQUIREMENTS_TEXT + "\n", encoding="utf-8")
    (scenario / "context.json").write_text(json.dumps(CONTEXT, indent=2), encoding="utf-8")
    return root / "scenarios"


# A real 1x1 PNG; the smallest thing the renderers accept as a diagram image.
PNG_DATA_URL = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlE"
    "QVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def export_media_types() -> dict[str, str]:
    return {
        "md": "text/markdown; charset=utf-8",
        "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "pdf": "application/pdf",
    }


def docx_text(content: bytes) -> str:
    document = Document(BytesIO(content))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def pdf_text(content: bytes) -> str:
    """PDF text with whitespace normalised, so a wrapped sentence still matches."""
    pages = [page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages]
    return " ".join(" ".join(pages).split())


@dataclass
class Journey:
    """Drives one session through the API and fails loudly on an unexpected status."""

    client: TestClient
    session_id: str

    @property
    def base(self) -> str:
        return f"/api/v1/sessions/{self.session_id}"

    def call(self, method: str, path: str, expect: int, json: Any = None) -> Any:
        response = self.client.request(method, f"{self.base}{path}", json=json)
        assert response.status_code == expect, f"{method} {path}: {response.text}"
        return response.json() if response.content and expect != 204 else None

    def get(self, path: str, expect: int = 200) -> Any:
        return self.call("GET", path, expect)

    def post(self, path: str, json: Any = None, expect: int = 200) -> Any:
        return self.call("POST", path, expect, json)

    def patch(self, path: str, json: Any = None, expect: int = 200) -> Any:
        return self.call("PATCH", path, expect, json)

    def put(self, path: str, json: Any = None, expect: int = 200) -> Any:
        return self.call("PUT", path, expect, json)

    def items(self) -> dict[str, dict[str, Any]]:
        scope = self.get("/scope")
        return {item["id"]: item for group in scope["groups"] for item in group["items"]}

    def artifacts(self) -> dict[str, dict[str, Any]]:
        return {row["kind"]: row for row in self.get("/artifacts")}

    def analyze(self) -> Any:
        return self.post("/analysis")

    def approve(self) -> Any:
        return self.post("/scope/approve")

    def generate(self, kind: str, expect: int = 200, **options: Any) -> Any:
        return self.post(f"/artifacts/{kind}/generate", json=options, expect=expect)

    def change(self, expect: int = 201, **payload: Any) -> Any:
        return self.post("/changes", json=payload, expect=expect)

    def regenerate(self, change_id: str) -> Any:
        return self.post(f"/changes/{change_id}/regenerate")

    def export(self, export_format: str) -> Any:
        """Export with both diagrams rendered, the way the browser sends them."""
        return self.client.post(
            f"{self.base}/package/export",
            json={
                "format": export_format,
                "architecture_diagram_png": PNG_DATA_URL,
                "integration_diagram_png": PNG_DATA_URL,
            },
        )

    def generate_all(self) -> None:
        """Every artifact of a complete session, in dependency order."""
        self.generate("prd")
        self.generate("functional_scope")
        self.generate("architecture", recommend=True)
        self.generate("data_strategy")
        self.generate("integration_architecture")
        self.generate("ai_strategy")
        self.generate("estimate_drivers")
        self.post("/estimate/calculate")
        self.generate("executive_summary")


def start(client: TestClient, rate_card_id: str = "usd-standard") -> Journey:
    """A session from the seeded scenario, analyzed, priced and approved."""
    created = client.post(f"/api/v1/sessions/from-scenario/{SLUG}")
    assert created.status_code == 201, created.text
    journey = Journey(client=client, session_id=created.json()["id"])
    journey.analyze()
    config = journey.get("/estimation-config")["session_config"]
    journey.put("/estimation-config", json={**config, "rate_card_id": rate_card_id})
    journey.approve()
    return journey
