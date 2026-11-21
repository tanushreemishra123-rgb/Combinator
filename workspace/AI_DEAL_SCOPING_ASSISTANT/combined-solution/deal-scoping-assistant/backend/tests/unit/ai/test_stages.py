"""Stage wiring: id assignment, prompts, and the S9/S11 schema limits."""

import json

from app.ai.context import GenerationContext
from app.ai.stages import STAGE_NAMES, gap_analysis
from app.ai.stages import extract_scope as extract_scope_stage
from app.ai.stages.base import DESCRIPTION_CHARS, PROMPTS_DIR, item_view, load_prompt
from app.ai.stages.executive_summary import ExecutiveSummaryDraft, to_executive_summary
from app.ai.stages.extract_scope import assign_ids
from app.domain.artifacts import EstimateDrivers
from app.domain.scope import (
    GapDetails,
    ItemType,
    NfrDetails,
    Origin,
    QuestionDetails,
    ScopeItemDetails,
)
from tests.unit.ai.conftest import ScriptedGenerator, make_document, make_draft, make_item

_FORBIDDEN_IN_DRIVERS = (
    "effort",
    "cost",
    "price",
    "rate",
    "week",
    "day",
    "hour",
    "date",
    "duration",
    "budget",
    "person",
)


def test_every_stage_has_a_prompt() -> None:
    for stage in STAGE_NAMES:
        assert (PROMPTS_DIR / f"{stage}.md").is_file()
        assert "Information hierarchy" in load_prompt(stage)


def test_ids_follow_the_type_prefix_and_continue_after_existing_ids() -> None:
    items = [
        make_draft("t1", ItemType.FUNCTIONAL_REQUIREMENT),
        make_draft(
            "t2",
            ItemType.NON_FUNCTIONAL_REQUIREMENT,
            details=ScopeItemDetails(nfr=NfrDetails(category="availability")),
        ),
        make_draft("t3", ItemType.FUNCTIONAL_REQUIREMENT),
    ]
    assigned, findings = assign_ids(items, {"FR_01"})
    assert [item.id for item in assigned] == ["FR_02", "NFR_01", "FR_03"]
    assert findings == []


def test_cross_references_are_rewritten() -> None:
    items = [
        make_draft("t1", ItemType.FUNCTIONAL_REQUIREMENT, related_ids=["t2"]),
        make_draft(
            "t2",
            ItemType.MISSING_INFORMATION,
            Origin.ASSUMED,
            related_ids=["t3"],
            absence_note="not mentioned in the customer input",
            details=ScopeItemDetails(gap=GapDetails(criticality="high", question_id="t3")),
        ),
        make_draft(
            "t3",
            ItemType.CLARIFICATION_QUESTION,
            Origin.ASSUMED,
            related_ids=["t2"],
            absence_note="not mentioned in the customer input",
            details=ScopeItemDetails(question=QuestionDetails(affected_ids=["t1", "FR_07"])),
        ),
    ]
    assigned, findings = assign_ids(items, {"FR_07"})
    by_id = {item.id: item for item in assigned}
    assert by_id["FR_08"].related_ids == ["GAP_01"]
    assert by_id["GAP_01"].details.gap is not None
    assert by_id["GAP_01"].details.gap.question_id == "Q_01"
    assert by_id["Q_01"].details.question is not None
    assert by_id["Q_01"].details.question.affected_ids == ["FR_08", "FR_07"]
    assert findings == []


def test_unknown_reference_is_dropped_with_a_warning() -> None:
    items = [make_draft("t1", related_ids=["t9"])]
    assigned, findings = assign_ids(items, set())
    assert assigned[0].related_ids == []
    assert "unknown item" in findings[0].message


def test_estimate_drivers_schema_has_no_effort_or_cost_fields() -> None:
    schema = json.dumps(EstimateDrivers.model_json_schema()["$defs"]).lower()
    field_names = json.dumps(
        [
            name
            for definition in EstimateDrivers.model_json_schema()["$defs"].values()
            for name in definition.get("properties", {})
        ]
    ).lower()
    assert "effort" not in field_names
    assert all(word not in field_names for word in _FORBIDDEN_IN_DRIVERS)
    assert "complexity" in schema


def test_executive_summary_draft_has_no_commercial_field() -> None:
    assert "commercial_summary" not in ExecutiveSummaryDraft.model_fields
    summary = to_executive_summary(
        ExecutiveSummaryDraft(overview="A portal."), "Effort 30 to 40 person-weeks."
    )
    assert summary.commercial_summary == "Effort 30 to 40 person-weeks."


def test_a_gap_inherits_the_quote_of_the_item_it_came_from() -> None:
    item = make_item("FR_01")
    gap = make_draft(
        "t1",
        ItemType.MISSING_INFORMATION,
        Origin.ASSUMED,
        source_refs=[],
        related_ids=["FR_01"],
        absence_note="no volumes given",
        details=ScopeItemDetails(gap=GapDetails(criticality="high", question_id="t2")),
    )
    paired_question = make_draft(
        "t2",
        ItemType.CLARIFICATION_QUESTION,
        Origin.ASSUMED,
        source_refs=[],
        related_ids=["t1"],
        absence_note="not mentioned in the customer input",
        details=ScopeItemDetails(question=QuestionDetails(why_it_matters="sizing")),
    )
    unlinked = make_draft(
        "t3",
        ItemType.MISSING_INFORMATION,
        Origin.ASSUMED,
        source_refs=[],
        related_ids=[],
        absence_note="not mentioned in the customer input",
        details=ScopeItemDetails(gap=GapDetails(criticality="low")),
    )
    gap_analysis.inherit_source_refs([gap, paired_question, unlinked], [item])
    assert gap.source_refs[0].quote == item.source_refs[0].quote
    assert gap.source_refs[0].verified is True
    # The question pairs with the gap, so the second pass gives it the same quote.
    assert paired_question.source_refs[0].quote == item.source_refs[0].quote
    assert unlinked.source_refs == []  # nothing to inherit, the absence note carries it


def test_item_views_carry_no_quotes_and_cap_descriptions() -> None:
    item = make_item("FR_01", description="d" * 400)
    view = item_view(item)
    assert "source_refs" not in view
    assert "created_at" not in view and "updated_at" not in view
    assert len(view["description"]) == DESCRIPTION_CHARS


def test_extraction_prompt_sends_the_documents_with_segment_ids() -> None:
    ctx = GenerationContext(generator=ScriptedGenerator({}), documents=[make_document()])
    request = extract_scope_stage.build(ctx)
    assert request.stage == "extract_scope"
    assert "D1.S1" in request.user
    assert "track shipments" in request.user


def test_gap_prompt_does_not_resend_the_documents() -> None:
    ctx = GenerationContext(
        generator=ScriptedGenerator({}), documents=[make_document()], items=[make_item("FR_01")]
    )
    request = gap_analysis.build(ctx)
    assert "track shipments" not in request.user  # the quote of the scope item stays out
    assert "FR_01" in request.user
    assert "document_outline" in request.user


def test_gap_or_question_without_any_quote_gets_the_absence_note() -> None:
    from app.ai.stages.drafts import DraftItem
    from app.ai.stages.gap_analysis import ABSENCE_NOTE, note_absence

    quoted = DraftItem(temp_id="t1", type="Q", title="How many users?", origin="assumed")
    kept = DraftItem(
        temp_id="t2",
        type="Q",
        title="Which region?",
        origin="assumed",
        absence_note="EU not stated",
    )
    note_absence([quoted, kept])
    assert quoted.absence_note == ABSENCE_NOTE
    assert kept.absence_note == "EU not stated"
