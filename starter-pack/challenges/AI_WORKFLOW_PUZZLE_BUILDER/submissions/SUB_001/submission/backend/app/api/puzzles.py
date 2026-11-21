"""Puzzle catalogue routes.

Responsibility: project the seeded catalogue into the two payloads the frontend
renders - the select-screen cards and the full builder payload - and nothing
else. The injector rules never leave the server; :meth:`Puzzle.detail` already
strips them.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.context import tool_catalogue
from app.api.schemas import PuzzleDetailOut
from app.engine.model import BlockType
from app.puzzles.models import PuzzleSummary
from app.puzzles.registry import PuzzleNotFound, get_puzzle, list_puzzles

router = APIRouter(prefix="/api", tags=["puzzles"])


@router.get("/puzzles")
async def get_puzzles() -> list[PuzzleSummary]:
    """Every puzzle as a select-screen card, in play order."""
    return list_puzzles()


@router.get(
    "/puzzles/{puzzle_id}",
    response_model=PuzzleDetailOut,
    response_model_exclude_unset=True,
)
async def get_puzzle_detail(puzzle_id: str) -> PuzzleDetailOut:
    """One puzzle's full builder payload.

    ``tools`` is present only when the puzzle's palette offers a Tool block; it
    drives the select on ``tool.tool`` instead of a free-text field.
    """
    try:
        puzzle = get_puzzle(puzzle_id)
    except PuzzleNotFound as exc:
        raise HTTPException(status_code=404, detail=f"No puzzle called {puzzle_id!r}.") from exc

    payload = puzzle.detail().model_dump()
    if BlockType.TOOL in puzzle.available_blocks:
        payload["tools"] = tool_catalogue()
    return PuzzleDetailOut.model_validate(payload)
