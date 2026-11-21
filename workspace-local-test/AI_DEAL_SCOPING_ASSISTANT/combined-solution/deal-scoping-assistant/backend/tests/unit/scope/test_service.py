"""Scope service: ids, edits, questions, assumptions, approval and the change seam."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from app.core.errors import Conflict, ValidationFailed
from app.db.models import ScopeSnapshot as SnapshotRow
from app.db.models import Session as SessionRow
from app.domain.scope import (
    AnswerStatus,
    AssumptionDetails,
    ConfirmationStatus,
    ItemStatus,
    ItemType,
    Origin,
    Priority,
    QuestionDetails,
    ScopeItemCreate,
    ScopeItemDetails,
    ScopeItemUpdate,
    ScopeStatus,
    SourceRef,
    UpdatedBy,
)
from app.scope.models import AnalyzedItem
from app.scope.service import (
    answer_question,
    approve_scope,
    build_view,
    create_item,
    decide_assumption,
    delete_item,
    replace_analysis,
    scope_locked,
    update_item,
)

REF = SourceRef(document_id="D1", segment_id="D1.S1", quote="a portal", verified=True)


@pytest.fixture
def session(db: DbSession) -> SessionRow:
    row = SessionRow(name="Scope test")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _requirement(title: str = "Login") -> ScopeItemCreate:
    return ScopeItemCreate(
        type=ItemType.FUNCTIONAL_REQUIREMENT,
        title=title,
        origin=Origin.CUSTOMER_STATED,
        source_refs=[REF],
    )


def _question() -> ScopeItemCreate:
    return ScopeItemCreate(
        type=ItemType.CLARIFICATION_QUESTION,
        title="How many users?",
        origin=Origin.AI_INFERRED,
        source_refs=[REF],
        details=ScopeItemDetails(question=QuestionDetails(why_it_matters="Sizing")),
    )


def _assumption() -> ScopeItemCreate:
    return ScopeItemCreate(
        type=ItemType.ASSUMPTION,
        title="5000 users",
        origin=Origin.ASSUMED,
        related_ids=["Q_01"],
        details=ScopeItemDetails(assumption=AssumptionDetails(impact_if_wrong="Sizing changes")),
    )


def test_ids_are_sequential_per_type(db: DbSession, session: SessionRow) -> None:
    first = create_item(db, session, _requirement("Login")).after
    second = create_item(db, session, _requirement("Search")).after
    question = create_item(db, session, _question()).after
    assert first is not None and second is not None and question is not None
    assert [first.id, second.id, question.id] == ["FR_01", "FR_02", "Q_01"]
    assert first.updated_by is UpdatedBy.USER
    assert first.status is ItemStatus.PROPOSED


def test_create_returns_the_before_and_after_seam(db: DbSession, session: SessionRow) -> None:
    change = create_item(db, session, _requirement())
    assert change.before is None
    assert change.after is not None and change.after.version == 1


def test_update_bumps_the_version_and_returns_both_states(
    db: DbSession, session: SessionRow
) -> None:
    created = create_item(db, session, _requirement()).after
    assert created is not None
    change = update_item(
        db, session, created.id, ScopeItemUpdate(title="Login with SSO", priority=Priority.MUST)
    )
    assert change.before is not None and change.after is not None
    assert change.before.title == "Login"
    assert change.after.title == "Login with SSO"
    assert change.after.priority is Priority.MUST
    assert change.after.version == 2
    assert change.after.updated_by is UpdatedBy.USER


def test_user_edit_may_remove_source_refs(db: DbSession, session: SessionRow) -> None:
    # Grounding rules bind AI output only; a reviewer's edit is trusted and marked as theirs.
    created = create_item(db, session, _requirement()).after
    assert created is not None
    updated = update_item(db, session, created.id, ScopeItemUpdate(source_refs=[])).after
    assert updated is not None and updated.source_refs == []


def test_delete_returns_the_removed_item(db: DbSession, session: SessionRow) -> None:
    created = create_item(db, session, _requirement()).after
    assert created is not None
    change = delete_item(db, session, created.id)
    assert change.after is None
    assert change.before is not None and change.before.id == created.id
    assert build_view(db, session).groups == []


def test_answer_question_records_the_answer(db: DbSession, session: SessionRow) -> None:
    question = create_item(db, session, _question()).after
    assert question is not None
    after = answer_question(db, session, question.id, "About 5,000.").after
    assert after is not None and after.details.question is not None
    assert after.details.question.answer == "About 5,000."
    assert after.details.question.answer_status is AnswerStatus.ANSWERED


def test_answer_on_a_non_question_is_rejected(db: DbSession, session: SessionRow) -> None:
    created = create_item(db, session, _requirement()).after
    assert created is not None
    with pytest.raises(ValidationFailed, match="not Q"):
        answer_question(db, session, created.id, "nope")


def test_confirm_and_reject_an_assumption(db: DbSession, session: SessionRow) -> None:
    create_item(db, session, _question())
    assumption = create_item(db, session, _assumption()).after
    assert assumption is not None
    confirmed = decide_assumption(db, session, assumption.id, confirmed=True).after
    assert confirmed is not None and confirmed.details.assumption is not None
    assert confirmed.details.assumption.confirmation_status is ConfirmationStatus.CONFIRMED
    assert confirmed.status is ItemStatus.PROPOSED

    rejected = decide_assumption(db, session, assumption.id, confirmed=False).after
    assert rejected is not None and rejected.details.assumption is not None
    assert rejected.details.assumption.confirmation_status is ConfirmationStatus.REJECTED
    assert rejected.status is ItemStatus.REJECTED


def test_approve_versions_the_scope_and_stores_a_snapshot(
    db: DbSession, session: SessionRow
) -> None:
    create_item(db, session, _requirement())
    view = approve_scope(db, session)
    assert view.scope_version == 1
    assert view.scope_status is ScopeStatus.APPROVED
    assert view.locked is True
    assert view.groups[0].items[0].status is ItemStatus.APPROVED
    snapshots = list(db.scalars(select(SnapshotRow).where(SnapshotRow.session_id == session.id)))
    assert len(snapshots) == 1
    assert snapshots[0].scope_version == 1
    assert snapshots[0].items[0]["id"] == "FR_01"


def test_approve_needs_items(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(Conflict, match="nothing to approve"):
        approve_scope(db, session)


def test_mutations_after_approval_point_at_the_change_service(
    db: DbSession, session: SessionRow
) -> None:
    question = create_item(db, session, _question()).after
    created = create_item(db, session, _requirement()).after
    assert question is not None and created is not None
    approve_scope(db, session)
    assert scope_locked(session) is True
    for call in (
        lambda: create_item(db, session, _requirement("Another")),
        lambda: update_item(db, session, created.id, ScopeItemUpdate(title="x")),
        lambda: delete_item(db, session, created.id),
        lambda: answer_question(db, session, question.id, "later"),
        lambda: approve_scope(db, session),
    ):
        with pytest.raises(Conflict) as error:
            call()
        assert "/changes" in error.value.detail


def test_replace_analysis_keeps_proposed_ids_and_fills_gaps(
    db: DbSession, session: SessionRow
) -> None:
    create_item(db, session, _requirement("Replaced away"))
    items = [
        AnalyzedItem(
            id="FR_07",
            type=ItemType.FUNCTIONAL_REQUIREMENT,
            title="Broker portal",
            origin=Origin.CUSTOMER_STATED,
            source_refs=[REF],
        ),
        AnalyzedItem(
            type=ItemType.FUNCTIONAL_REQUIREMENT,
            title="Reporting",
            origin=Origin.CUSTOMER_STATED,
            source_refs=[REF],
        ),
    ]
    stored = replace_analysis(db, session, items)
    assert [item.id for item in stored] == ["FR_07", "FR_08"]
    assert all(item.updated_by is UpdatedBy.AI for item in stored)
    assert session.scope_status == ScopeStatus.ANALYZED.value
    assert [item.title for group in build_view(db, session).groups for item in group.items] == [
        "Broker portal",
        "Reporting",
    ]


def test_replace_analysis_is_blocked_after_approval(db: DbSession, session: SessionRow) -> None:
    create_item(db, session, _requirement())
    approve_scope(db, session)
    with pytest.raises(Conflict, match="change"):
        replace_analysis(db, session, [AnalyzedItem.model_validate(_requirement().model_dump())])


def test_replace_analysis_needs_items(db: DbSession, session: SessionRow) -> None:
    with pytest.raises(ValidationFailed, match="no scope items"):
        replace_analysis(db, session, [])
