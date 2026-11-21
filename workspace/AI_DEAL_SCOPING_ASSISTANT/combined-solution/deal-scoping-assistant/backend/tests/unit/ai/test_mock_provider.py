"""Recorded-response lookup order and reconciliation against the current scope."""

import json
from pathlib import Path

import pytest

from app.ai.errors import MockResponseMissing
from app.ai.mock_provider import RECORDED, RECORDED_FALLBACK, MockGenerator, reconcile
from app.ai.stages.drafts import ScopeExtraction
from app.domain.artifacts import FunctionalScope, Prd
from app.domain.scope import ItemStatus, ItemType
from tests.unit.ai.conftest import SCENARIOS, make_item


def generator(tmp_path: Path | None = None) -> MockGenerator:
    return MockGenerator(scenario_slug="demo", scenarios_dir=tmp_path or SCENARIOS)


def test_exact_variant_wins(tmp_path: Path) -> None:
    mock = tmp_path / "demo" / "mock"
    mock.mkdir(parents=True)
    (mock / "architecture.json").write_text("{}")
    (mock / "architecture.aws.json").write_text("{}")
    path, label = generator(tmp_path).find_file("architecture.aws")
    assert path.name == "architecture.aws.json"
    assert label == RECORDED


def test_base_file_is_used_when_the_variant_is_missing(tmp_path: Path) -> None:
    mock = tmp_path / "demo" / "mock"
    mock.mkdir(parents=True)
    (mock / "architecture.json").write_text("{}")
    path, label = generator(tmp_path).find_file("architecture.gcp")
    assert path.name == "architecture.json"
    assert label == RECORDED_FALLBACK


def test_nearest_variant_is_a_labelled_fallback(tmp_path: Path) -> None:
    mock = tmp_path / "demo" / "mock"
    mock.mkdir(parents=True)
    (mock / "architecture.azure.json").write_text("{}")
    path, label = generator(tmp_path).find_file("architecture.gcp")
    assert path.name == "architecture.azure.json"
    assert label == RECORDED_FALLBACK


def test_missing_stage_raises(tmp_path: Path) -> None:
    (tmp_path / "demo" / "mock").mkdir(parents=True)
    with pytest.raises(MockResponseMissing):
        generator(tmp_path).find_file("prd")


def test_generate_parses_the_recorded_file() -> None:
    prd = generator().generate("prd", Prd, "system", "user")
    assert prd.functional_requirements[0].req_id == "FR_01"


def recorded_functional_scope() -> dict[str, object]:
    path = SCENARIOS / "demo" / "mock" / "functional_scope.json"
    return dict(json.loads(path.read_text()))


def test_reconcile_drops_references_to_rejected_items() -> None:
    scope = [
        make_item("FR_01"),
        make_item(
            "NFR_01",
            ItemType.NON_FUNCTIONAL_REQUIREMENT,
            details={"nfr": {"category": "availability"}},
        ),
    ]
    content, findings = reconcile(
        {"integrations": [{"id": "IA_01", "req_ids": ["INT_01", "FR_01"], "arc_ids": ["ARC_01"]}]},
        scope,
    )
    integration = content["integrations"][0]  # type: ignore[index]
    assert integration["req_ids"] == ["FR_01"]
    assert integration["arc_ids"] == ["ARC_01"]  # artifact ids are left alone
    assert findings[0].ids == ["INT_01"]


def test_reconcile_keeps_elements_that_lose_every_reference() -> None:
    scope = [make_item("FR_01")]
    content, findings = reconcile(recorded_functional_scope(), scope)
    scope_model = FunctionalScope.model_validate(content)
    assert [cap.id for cap in scope_model.capabilities] == ["CAP_01", "CAP_02", "CAP_03"]
    assert scope_model.capabilities[1].included_req_ids == ["NFR_01"]
    assert any("unsupported addition" in finding.message for finding in findings)


def test_reconcile_clears_a_single_stale_id() -> None:
    content, _ = reconcile({"gap": {"question_id": "Q_09", "assumption_id": ""}}, [])
    assert content["gap"]["question_id"] == ""  # type: ignore[index]


def test_reconcile_ignores_user_added_items() -> None:
    scope = [make_item("FR_01"), make_item("FR_02")]
    content, findings = reconcile({"capabilities": [{"id": "CAP_01", "req_ids": ["FR_01"]}]}, scope)
    assert content["capabilities"][0]["req_ids"] == ["FR_01"]  # type: ignore[index]
    assert findings == []


def test_rejected_item_counts_as_removed() -> None:
    scope = [make_item("FR_01", status=ItemStatus.REJECTED)]
    content, findings = reconcile({"prd": {"req_ids": ["FR_01"]}}, scope)
    assert content["prd"]["req_ids"] == []  # type: ignore[index]
    assert findings


def test_an_extraction_answer_is_replayed_untouched() -> None:
    """Its temp ids may look like scope ids (GAP_01), so reconciliation must skip them."""
    mock = generator()
    mock.scope = [make_item("FR_01")]
    extraction = mock.generate("gap_analysis", ScopeExtraction, "system", "user")
    assert [item.temp_id for item in extraction.items] == ["g1", "q1"]
    assert extraction.items[0].question_id == "q1"
    assert mock.findings == []


def test_generate_reconciles_before_validation() -> None:
    mock = generator()
    mock.scope = [make_item("FR_01")]
    result = mock.generate("functional_scope", FunctionalScope, "system", "user")
    assert result.capabilities[0].included_req_ids == ["FR_01"]
    assert mock.findings
