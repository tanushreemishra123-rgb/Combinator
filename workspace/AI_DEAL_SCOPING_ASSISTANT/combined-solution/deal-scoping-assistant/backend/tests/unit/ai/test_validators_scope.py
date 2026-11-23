"""id_references, source_refs and scope_rules."""

from app.ai.findings import FindingLevel
from app.ai.validators.id_references import check_id_references, collect_references
from app.ai.validators.scope_rules import check_scope_rules
from app.ai.validators.source_refs import check_source_refs
from app.domain.artifacts import Basis, Capability, FunctionalScope, ScopeClass
from app.domain.scope import (
    GapCriticality,
    GapDetails,
    ItemType,
    Origin,
    ScopeItemDetails,
    SourceDocument,
    SourceRef,
)
from tests.unit.ai.conftest import make_draft, make_item


def capability(cap_id: str, req_ids: list[str]) -> Capability:
    return Capability(
        id=cap_id,
        name=cap_id,
        description="",
        included_req_ids=req_ids,
        priority="medium",
        scope_class=ScopeClass.CUSTOMER_REQUESTED,
        basis=Basis.CUSTOMER,
    )


def test_known_ids_pass() -> None:
    content = FunctionalScope(capabilities=[capability("CAP_01", ["FR_01", "NFR_02"])])
    assert check_id_references(content, {"FR_01", "NFR_02"}) == []


def test_unknown_id_is_an_error() -> None:
    content = FunctionalScope(capabilities=[capability("CAP_01", ["FR_09"])])
    findings = check_id_references(content, {"FR_01"})
    assert [f.ids for f in findings] == [["FR_09"]]
    assert findings[0].level is FindingLevel.ERROR


def test_ids_defined_in_the_content_count_as_known() -> None:
    content = FunctionalScope(
        capabilities=[capability("CAP_01", ["FR_01"])],
        workstreams=[
            {"id": "WS_01", "name": "w", "capability_ids": ["CAP_01"], "basis": "inferred"}
        ],  # type: ignore[list-item]
    )
    assert check_id_references(content, {"FR_01"}) == []


def test_collect_references_separates_definitions() -> None:
    defined, refs = collect_references(
        FunctionalScope(capabilities=[capability("CAP_01", ["FR_01"])])
    )
    assert "CAP_01" in defined
    assert "FR_01" in refs


def test_mock_mode_downgrades_to_warning() -> None:
    content = FunctionalScope(capabilities=[capability("CAP_01", ["FR_09"])])
    findings = check_id_references(content, set(), FindingLevel.WARNING)
    assert findings[0].level is FindingLevel.WARNING


def test_matching_quote_is_verified_with_offsets(document: SourceDocument) -> None:
    item = make_item(
        "FR_01",
        source_refs=[
            SourceRef(
                document_id="D1",
                segment_id="D1.S2",
                quote="  stay   available during business hours  ",
            )
        ],
    )
    assert check_source_refs([item], [document]) == []
    ref = item.source_refs[0]
    assert ref.verified is True
    assert document.normalized_text[ref.start : ref.end] == "stay available during business hours"


def test_invented_quote_is_reported_and_kept(document: SourceDocument) -> None:
    item = make_item(
        "FR_01",
        source_refs=[SourceRef(document_id="D1", segment_id="D1.S1", quote="pay by card")],
    )
    findings = check_source_refs([item], [document])
    assert findings[0].level is FindingLevel.WARNING
    assert item.source_refs[0].verified is False
    assert item.source_refs  # the reference is kept for the reviewer


def test_unknown_segment_is_reported(document: SourceDocument) -> None:
    item = make_item(
        "FR_01",
        source_refs=[SourceRef(document_id="D1", segment_id="D1.S9", quote="anything")],
    )
    findings = check_source_refs([item], [document])
    assert "does not exist" in findings[0].message


def test_scope_rules_accept_a_grounded_scope() -> None:
    gap = make_item(
        "GAP_01",
        ItemType.MISSING_INFORMATION,
        Origin.ASSUMED,
        source_refs=[],
        absence_note="not mentioned in the customer input",
        related_ids=["Q_01"],
        details=ScopeItemDetails(
            gap=GapDetails(criticality=GapCriticality.HIGH, question_id="Q_01")
        ),
    )
    assert check_scope_rules([make_item("FR_01"), gap]) == []


def test_customer_stated_without_source_is_an_error() -> None:
    item = make_draft("t1", origin=Origin.AI_INFERRED, source_refs=[])
    messages = [f.message for f in check_scope_rules([item])]
    assert any("source reference" in message for message in messages)


def test_unverified_customer_quote_is_a_warning() -> None:
    item = make_item(
        "FR_01",
        source_refs=[SourceRef(document_id="D1", segment_id="D1.S1", quote="x", verified=False)],
    )
    findings = check_scope_rules([item])
    assert findings[0].level is FindingLevel.WARNING


def test_critical_gap_without_question_or_assumption_is_an_error() -> None:
    gap = make_draft(
        "t1",
        ItemType.MISSING_INFORMATION,
        Origin.AI_INFERRED,
        source_refs=[SourceRef(document_id="D1", segment_id="D1.S1", quote="x", verified=True)],
        details=ScopeItemDetails(gap=GapDetails(criticality=GapCriticality.HIGH)),
    )
    messages = [f.message for f in check_scope_rules([gap])]
    assert any("high-criticality gap" in message for message in messages)


def test_missing_type_details_is_an_error() -> None:
    item = make_draft("t1", ItemType.NON_FUNCTIONAL_REQUIREMENT)
    assert any("details.nfr" in f.message for f in check_scope_rules([item]))


def test_assumed_item_needs_a_gap_or_question() -> None:
    item = make_draft("t1", ItemType.SECURITY_COMPLIANCE, Origin.ASSUMED, related_ids=["FR_01"])
    messages = [f.message for f in check_scope_rules([item])]
    assert any("must link to a gap" in message for message in messages)


def test_invented_id_prefixes_are_still_checked() -> None:
    content = FunctionalScope(capabilities=[capability("CAP_01", ["REQ_01"])])
    findings = check_id_references(content, {"FR_01"})
    assert findings and findings[0].ids == ["REQ_01"]


def test_second_document_keeps_its_own_reference() -> None:
    from app.ai.stages.drafts import document_of

    assert document_of("D2.S5", "D1") == "D2"
    assert document_of("broken", "D1") == "D1"
