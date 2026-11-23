"""Coverage matrix, percentages and unsupported additions."""

from app.domain.artifacts import ArtifactKind
from app.domain.scope import ConfirmationStatus, ItemStatus, ItemType
from app.traceability.coverage import CoverageColumn, build_coverage, supporting_ids
from tests.unit import _fixtures as fx


def _report(items=None, contents=None):
    return build_coverage(
        fx.scope_items() if items is None else items,
        fx.artifact_contents() if contents is None else contents,
    )


def _row(report, item_id):
    return next(row for row in report.rows if row.item_id == item_id)


def _cell(report, item_id, column):
    return next(cell for cell in _row(report, item_id).cells if cell.column is column)


def test_clean_session_is_fully_covered():
    report = _report()
    assert report.counted_count == 8
    assert report.coverage_pct == 100.0
    assert report.uncovered_ids == []
    assert report.high_priority_pct == 100.0
    assert report.unsupported_additions == []


def test_every_non_rejected_item_has_a_row_with_its_references():
    report = _report()
    assert len(report.rows) == len(fx.scope_items())
    assert _cell(report, "FR_01", CoverageColumn.CAPABILITY).element_ids == ["CAP_01"]
    assert _cell(report, "FR_01", CoverageColumn.ARCHITECTURE).element_ids == [
        "ARC_02",
        "deployment_runtime",
    ]
    assert "IA_01" in _cell(report, "INT_01", CoverageColumn.INTEGRATION).element_ids
    assert "AI_01" in _cell(report, "FR_03", CoverageColumn.AI).element_ids
    assert "WS_01" in _cell(report, "FR_01", CoverageColumn.WORKSTREAM).element_ids


def test_context_types_stay_visible_but_do_not_count_in_the_percentage():
    report = _report()
    for item_id in ("BR_01", "PER_01", "TECH_01", "RISK_01", "GAP_01", "Q_01", "ASM_01"):
        row = _row(report, item_id)
        assert row.counts_in_percentage is False
    assert _cell(report, "BR_01", CoverageColumn.PRD).covered is True


def test_rejected_items_leave_the_matrix():
    items = fx.scope_items()
    next(item for item in items if item.id == "RISK_01").status = ItemStatus.REJECTED
    report = _report(items=items)
    assert all(row.item_id != "RISK_01" for row in report.rows)


def test_a_modified_item_still_counts_as_reviewed():
    items = fx.scope_items()
    next(item for item in items if item.id == "FR_01").status = ItemStatus.MODIFIED
    report = _report(items=items)
    assert _row(report, "FR_01").counts_in_percentage is True
    assert report.coverage_pct == 100.0


def test_a_requirement_no_capability_covers_is_reported_as_uncovered():
    contents = fx.artifact_contents()
    capability = contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][1]
    capability["included_req_ids"] = ["FR_02"]
    capability["req_ids"] = ["FR_02"]
    report = _report(contents=contents)
    assert report.uncovered_ids == ["NFR_02"]
    assert report.coverage_pct == 87.5
    # NFR_02 is medium, so high-priority coverage is untouched.
    assert report.high_priority_uncovered_ids == []


def test_an_uncovered_high_priority_requirement_is_listed_separately():
    contents = fx.artifact_contents()
    capability = contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"][3]
    capability["included_req_ids"] = ["DATA_01"]
    capability["req_ids"] = ["DATA_01"]
    report = _report(contents=contents)
    assert report.high_priority_uncovered_ids == ["NFR_01", "SEC_01"]
    assert report.high_priority_pct < 100.0


def test_a_capability_referencing_an_unknown_id_is_an_unsupported_addition():
    contents = fx.artifact_contents()
    contents[ArtifactKind.FUNCTIONAL_SCOPE]["capabilities"].append(
        {
            "id": "CAP_09",
            "name": "Loyalty programme",
            "description": "Not asked for.",
            "included_req_ids": ["FR_99"],
            "req_ids": ["FR_99"],
            "priority": "medium",
            "dependencies": [],
            "module": "",
            "workstream_id": "",
            "delivery_package_id": "",
            "scope_class": "recommended_enhancement",
            "basis": "recommended",
            "validation_required": False,
            "validation_reason": "",
        }
    )
    report = _report(contents=contents)
    addition = next(entry for entry in report.unsupported_additions if entry.element_id == "CAP_09")
    assert addition.artifact is ArtifactKind.FUNCTIONAL_SCOPE
    assert "unknown" in addition.reason


def test_an_element_referencing_only_a_rejected_item_is_unsupported():
    items = fx.scope_items()
    next(item for item in items if item.id == "INT_01").status = ItemStatus.REJECTED
    report = _report(items=items)
    unsupported = {entry.element_id for entry in report.unsupported_additions}
    assert "IA_01" in unsupported
    assert "ARC_05" in unsupported


def test_an_element_supported_only_by_a_rejected_assumption_is_unsupported():
    items = fx.scope_items()
    assumption = next(item for item in items if item.id == "ASM_01")
    assert assumption.details.assumption is not None
    assumption.details.assumption.confirmation_status = ConfirmationStatus.REJECTED
    contents = fx.artifact_contents()
    component = contents[ArtifactKind.ARCHITECTURE]["components"][5]
    component["supported_ids"] = ["ASM_01"]
    component["req_ids"] = ["ASM_01"]
    report = build_coverage(items, contents)
    assert any(entry.element_id == "ARC_06" for entry in report.unsupported_additions)


def test_supporting_ids_excludes_rejected_and_unapproved_items():
    items = fx.scope_items()
    next(item for item in items if item.id == "FR_01").status = ItemStatus.REJECTED
    next(item for item in items if item.id == "FR_02").status = ItemStatus.PROPOSED
    supported = supporting_ids(items)
    assert "FR_01" not in supported
    assert "FR_02" not in supported
    assert "FR_03" in supported


def test_coverage_of_an_empty_session_is_neutral():
    report = build_coverage([], {})
    assert report.coverage_pct == 100.0
    assert report.rows == []


def test_percentage_counts_only_requirement_types():
    report = _report()
    counted = {row.item_type for row in report.rows if row.counts_in_percentage}
    assert counted == {
        ItemType.FUNCTIONAL_REQUIREMENT,
        ItemType.NON_FUNCTIONAL_REQUIREMENT,
        ItemType.INTEGRATION,
        ItemType.DATA_REQUIREMENT,
        ItemType.SECURITY_COMPLIANCE,
    }
