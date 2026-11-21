"""Scope review: listing, item edits, questions, assumptions and approval."""

from fastapi import APIRouter, status

from app.domain.scope import ScopeItem, ScopeItemCreate, ScopeItemUpdate
from app.scope.models import QuestionAnswer, ScopeView
from app.scope.service import (
    answer_question,
    build_view,
    create_item,
    decide_assumption,
    delete_item,
    update_item,
)
from app.scope.service import approve_scope as approve_scope_service
from app.sessions.deps import Db, LoadedSession

router = APIRouter(prefix="/sessions/{session_id}/scope", tags=["scope"])


@router.get("", response_model=ScopeView)
def read_scope(session: LoadedSession, db: Db) -> ScopeView:
    return build_view(db, session)


@router.post("/items", response_model=ScopeItem, status_code=status.HTTP_201_CREATED)
def add_item(payload: ScopeItemCreate, session: LoadedSession, db: Db) -> ScopeItem:
    change = create_item(db, session, payload)
    return _changed(change.after)


@router.patch("/items/{item_id}", response_model=ScopeItem)
def edit_item(item_id: str, payload: ScopeItemUpdate, session: LoadedSession, db: Db) -> ScopeItem:
    return _changed(update_item(db, session, item_id, payload).after)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(item_id: str, session: LoadedSession, db: Db) -> None:
    delete_item(db, session, item_id)


@router.post("/questions/{item_id}/answer", response_model=ScopeItem)
def answer(item_id: str, payload: QuestionAnswer, session: LoadedSession, db: Db) -> ScopeItem:
    return _changed(answer_question(db, session, item_id, payload.answer).after)


@router.post("/assumptions/{item_id}/confirm", response_model=ScopeItem)
def confirm_assumption(item_id: str, session: LoadedSession, db: Db) -> ScopeItem:
    return _changed(decide_assumption(db, session, item_id, confirmed=True).after)


@router.post("/assumptions/{item_id}/reject", response_model=ScopeItem)
def reject_assumption(item_id: str, session: LoadedSession, db: Db) -> ScopeItem:
    return _changed(decide_assumption(db, session, item_id, confirmed=False).after)


@router.post("/approve", response_model=ScopeView)
def approve(session: LoadedSession, db: Db) -> ScopeView:
    return approve_scope_service(db, session)


def _changed(item: ScopeItem | None) -> ScopeItem:
    if item is None:  # pragma: no cover - mutations that keep the item always return one
        raise RuntimeError("the mutation returned no item")
    return item
