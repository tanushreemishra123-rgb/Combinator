"""The end-to-end journey in mock mode: analyze, approve, generate, change, export."""

import json
from typing import Any

from fastapi.testclient import TestClient

from app.domain.package import DISCLAIMER
from tests.api.journey import (
    Journey,
    docx_text,
    export_media_types,
    pdf_text,
    start,
)

USER_ITEM = {
    "type": "DATA",
    "title": "Delivery history export",
    "description": "Customers can export their delivery history.",
    "priority": "medium",
    "origin": "customer_stated",
    "notes": "Raised by the customer on the call.",
}


def _detail(problem: Any) -> str:
    return str(problem["detail"])


def test_journey_scope_review_and_generation(seeded_client: TestClient) -> None:
    journey = Journey(
        client=seeded_client,
        session_id=seeded_client.post("/api/v1/sessions/from-scenario/demo").json()["id"],
    )
    assert [document["id"] for document in journey.get("/documents")] == ["D1"]
    assert "approved" in _detail(journey.generate("prd", expect=409))

    analysis = journey.analyze()
    assert analysis["mock_notice"] == ""
    assert analysis["findings"] == []

    # Every recorded quote is verified against the real document text and its offsets.
    document = journey.get("/documents/D1")
    refs = [ref for item in journey.items().values() for ref in item["source_refs"]]
    verified = [ref for ref in refs if ref["verified"]]
    assert verified
    for ref in verified:
        assert ref["document_id"] == "D1"
        assert document["normalized_text"][ref["start"] : ref["end"]] == ref["quote"]

    journey.patch("/scope/items/FR_01", {"title": "Live shipment tracking"})
    journey.patch("/scope/items/NFR_01", {"status": "rejected"})
    added = journey.post("/scope/items", USER_ITEM, expect=201)
    assert added["id"] == "DATA_01"

    config = journey.get("/estimation-config")["session_config"]
    journey.put("/estimation-config", json={**config, "rate_card_id": "usd-standard"})
    journey.approve()
    assert journey.get("/scope")["locked"] is True
    locked = journey.patch("/scope/items/FR_01", {"notes": "again"}, expect=409)
    assert "/changes" in _detail(locked)

    assert "prd" in _detail(journey.generate("functional_scope", expect=409))
    journey.generate("prd")
    assert "functional_scope" in _detail(journey.generate("architecture", expect=409))
    journey.generate("functional_scope")
    assert "cloud platform" in _detail(journey.generate("architecture", expect=409))
    assert "architecture" in _detail(journey.generate("data_strategy", expect=409))

    architecture = journey.generate("architecture", recommend=True)
    assert architecture["artifact"]["content"]["platform"] == "aws"
    session = journey.get("")
    assert (session["cloud_platform"], session["platform_mode"]) == ("aws", "recommended")

    journey.generate("data_strategy")
    journey.generate("integration_architecture")
    journey.generate("ai_strategy")
    assert "estimate" in _detail(journey.generate("executive_summary", expect=409))
    assert "drivers" in _detail(journey.post("/estimate/calculate", expect=409))
    journey.generate("estimate_drivers")

    estimate = journey.post("/estimate/calculate")
    assert estimate["rom"]["currency"] == "USD"
    assert estimate["rom"]["amount_high"] > estimate["rom"]["amount_low"] > 0
    summary = journey.generate("executive_summary")["artifact"]["content"]
    assert str(int(estimate["effort_low"])) in summary["commercial_summary"]
    assert journey.get("/coverage")["counted_count"] > 0


def test_changes_mark_only_what_they_touch(journey: Journey) -> None:
    journey.generate_all()
    before = journey.artifacts()
    config = journey.get("/estimation-config")["session_config"]

    record = journey.change(
        change_type="config_change",
        description="The customer states 5000 expected users.",
        config={**config, "expected_users": 5000},
    )
    affected = {entry["artifact"]: entry["action"] for entry in record["affected"]}
    assert affected == {
        "architecture": "regenerate",
        "estimate": "recalculate",
        "executive_summary": "regenerate",
    }
    assert record["stale_kinds"] == ["architecture", "estimate", "executive_summary"]
    assert any(line == "Data strategy" for line in record["unaffected_summary"])
    after = journey.artifacts()
    for kind in ("prd", "functional_scope", "data_strategy", "integration_architecture"):
        assert after[kind]["status"] == "fresh"
        assert after[kind]["version"] == before[kind]["version"]
        assert after[kind]["content"] == before[kind]["content"]

    regenerated = journey.regenerate(record["id"])
    assert [row["kind"] for row in regenerated["regenerated"]] == [
        "architecture",
        "executive_summary",
    ]
    fresh = journey.artifacts()
    assert {row["status"] for row in fresh.values()} == {"fresh"}
    assert fresh["architecture"]["version"] == 2
    assert fresh["prd"]["version"] == before["prd"]["version"]
    assert fresh["prd"]["content"] == before["prd"]["content"]


def test_regenerated_summary_quotes_the_recalculated_estimate(journey: Journey) -> None:
    journey.generate_all()
    old_rom = journey.get("/estimate")["rom"]
    config = journey.get("/estimation-config")["session_config"]
    record = journey.change(
        change_type="config_change",
        description="The customer is regulated.",
        config={**config, "security_level": "regulated"},
    )
    assert "executive_summary" in record["stale_kinds"]

    rom = journey.regenerate(record["id"])["estimate"]["rom"]
    assert rom["amount_high"] > old_rom["amount_high"]
    paragraph = journey.artifacts()["executive_summary"]["content"]["commercial_summary"]
    assert f"{rom['amount_high']:,.0f} {rom['currency']}" in paragraph


def test_commercial_change_only_recalculates(journey: Journey) -> None:
    journey.generate_all()
    before = journey.artifacts()
    config = journey.get("/estimation-config")["session_config"]

    record = journey.change(
        change_type="config_change",
        description="Contingency goes to 20 percent.",
        config={**config, "contingency_pct": 20},
    )
    assert [entry["artifact"] for entry in record["affected"]] == ["estimate"]
    assert record["stale_kinds"] == ["estimate"]
    after = journey.artifacts()
    assert {row["status"] for row in after.values()} == {"fresh"}
    assert after["estimate"]["version"] == before["estimate"]["version"] + 1
    assert journey.get("/estimate")["rom"]["contingency_pct"] == 20
    for kind in ("prd", "architecture"):
        assert after[kind]["content"] == before[kind]["content"]
    # Only the summary's commercial paragraph follows the new numbers; the rest is kept.
    summary, old_summary = after["executive_summary"], before["executive_summary"]
    assert summary["version"] == old_summary["version"]
    assert "including 20% contingency" in summary["content"]["commercial_summary"]
    assert {**summary["content"], "commercial_summary": ""} == {
        **old_summary["content"],
        "commercial_summary": "",
    }


def test_platform_change_regenerates_only_the_architecture(journey: Journey) -> None:
    journey.generate_all()
    before = journey.artifacts()
    record = journey.change(
        change_type="config_change",
        description="The customer moves to Azure.",
        platform_change=True,
        cloud_platform="azure",
    )
    actions = {entry["artifact"]: entry["action"] for entry in record["affected"]}
    assert actions["architecture"] == "regenerate"
    assert actions["data_strategy"] == actions["integration_architecture"] == "relink"
    assert actions["ai_strategy"] == "relink"
    after = journey.artifacts()
    assert after["architecture"]["status"] == "stale"
    for kind in ("data_strategy", "integration_architecture", "ai_strategy"):
        assert after[kind]["status"] == "fresh"
        assert after[kind]["content"] == before[kind]["content"]

    journey.regenerate(record["id"])
    architecture = journey.get("/artifacts/architecture")["content"]
    assert architecture["platform"] == "azure"
    # Platform-neutral strategies keep pointing at the same components.
    assert [component["id"] for component in architecture["components"]] == [
        component["id"] for component in before["architecture"]["content"]["components"]
    ]


def test_unit_complexity_edit_is_recorded_and_recalculates_the_estimate(journey: Journey) -> None:
    journey.generate_all()
    before = journey.get("/estimate")
    record = journey.change(
        change_type="unit_complexity",
        description="CAP_01 is harder than first rated.",
        unit_complexity=[{"unit_id": "CAP_01", "complexity": "very_high"}],
    )
    assert record["stale_kinds"] == ["estimate"]  # numbers move, no document is regenerated
    assert journey.get("/estimate")["effort_high"] > before["effort_high"]
    units = journey.get("/artifacts/estimate_drivers")["content"]["units"]
    assert next(u for u in units if u["unit_id"] == "CAP_01")["complexity"] == "very_high"


def test_deliberate_inconsistency_is_reported_and_then_repaired(seeded_client: TestClient) -> None:
    journey = start(seeded_client)
    journey.generate_all()
    assert journey.post("/quality-gate/run")["summary"]["export_status"] == "review_required"

    record = journey.change(
        change_type="scope_item_status",
        description="FR_01 is taken out of scope.",
        item_ids=["FR_01"],
        item_update={"status": "rejected"},
    )
    journey.generate("prd")  # only the PRD is brought up to date, on purpose
    gate = {check["id"]: check for check in journey.post("/quality-gate/run")["checks"]}
    assert gate["QG_12"]["status"] == "warning"
    assert gate["QG_13"]["status"] == "failed"
    assert "FR_01" in gate["QG_13"]["message"]
    assert journey.get("/quality-gate")["summary"]["export_status"] == "review_required"

    journey.regenerate(record["id"])
    repaired = {check["id"]: check for check in journey.post("/quality-gate/run")["checks"]}
    assert repaired["QG_12"]["status"] == "passed"
    assert {row["status"] for row in journey.artifacts().values()} == {"fresh"}


def test_package_builds_and_exports_in_every_format(journey: Journey) -> None:
    journey.generate_all()
    diagrams = journey.get("/diagrams")
    assert diagrams["architecture_mermaid"].startswith("flowchart")
    assert diagrams["integration_mermaid"].startswith("flowchart")

    version = journey.get("")["scope_version"]
    document = journey.post("/package/build")
    assert document["disclaimer"] == DISCLAIMER
    assert len(document["sections"]) == 21
    assert journey.get("/package")["sections"][0]["id"] == "PKG_01"

    for export_format, media_type in export_media_types().items():
        response = journey.export(export_format)
        assert response.status_code == 200, response.text
        assert response.headers["content-type"] == media_type
        disposition = response.headers["content-disposition"]
        assert disposition.endswith(f'-v{version}.{export_format}"')
        assert "scoping-package-northwind-logistics" in disposition
        if export_format == "md":
            assert DISCLAIMER in response.content.decode("utf-8")
        elif export_format == "docx":
            assert DISCLAIMER in docx_text(response.content)
        else:
            assert " ".join(DISCLAIMER.split()) in pdf_text(response.content)


def test_export_rejects_an_image_that_is_not_a_png(journey: Journey) -> None:
    journey.generate_all()
    journey.post("/package/build")
    response = journey.client.post(
        f"{journey.base}/package/export",
        json={"format": "docx", "architecture_diagram_png": "data:image/svg+xml;base64,PHN2Zy8+"},
    )
    assert response.status_code == 422
    assert "data:image/png;base64," in response.json()["detail"]


def test_deleting_the_session_removes_everything(journey: Journey) -> None:
    from sqlalchemy import select

    from app.db.models import Artifact, ChangeRecord, Package, QualityReport, ScopeItem
    from app.db.session import get_session_factory

    journey.generate_all()
    journey.post("/quality-gate/run")
    journey.post("/package/build")
    journey.change(
        change_type="question_answered",
        description="The customer answered the volume question.",
        item_ids=["Q_01"],
        answer="About 5000 customers.",
    )
    assert journey.client.delete(journey.base).status_code == 204
    journey.get("", expect=404)
    with get_session_factory()() as db:
        for model in (Artifact, ChangeRecord, Package, QualityReport, ScopeItem):
            rows = db.scalars(select(model).where(model.session_id == journey.session_id)).all()
            assert rows == [], model.__name__


def test_a_change_makes_the_stored_package_and_report_expire(journey: Journey) -> None:
    journey.generate_all()
    journey.post("/quality-gate/run")
    built = journey.post("/package/build")
    assert journey.get("/package")["sections"]

    config = journey.get("/estimation-config")["session_config"]
    journey.change(
        change_type="config_change",
        description="Contingency goes to 25 percent.",
        config={**config, "contingency_pct": 25},
    )
    # The old report and package describe a state that no longer exists, so they are gone.
    journey.get("/quality-gate", expect=404)
    journey.get("/package", expect=404)

    # Export never ships the old package: it rebuilds from the current state first.
    exported = journey.export("md").text
    assert "Contingency: 25%" in exported
    assert json.dumps(journey.get("/package")) != json.dumps(built)
