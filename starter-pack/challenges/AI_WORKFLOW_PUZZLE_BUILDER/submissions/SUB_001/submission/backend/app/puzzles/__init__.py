"""Seeded puzzle definitions: broken workflows, sample inputs, expected schemas, failure
configs, completion criteria and committed mock responses.

Each puzzle lives in ``data/<order>_<id>.json`` and is parsed through the strict
models in :mod:`app.puzzles.models`. :mod:`app.puzzles.registry` is the entry
point: the catalogue for the API, and the per-puzzle fixtures bundle that lets a
run happen with no network and no API key.
"""

from __future__ import annotations

from app.puzzles.models import (
    CompletionCheck,
    Puzzle,
    PuzzleDetail,
    PuzzleEdge,
    PuzzleNode,
    PuzzleSummary,
    PuzzleWorkflow,
    ScenarioSummary,
)
from app.puzzles.registry import (
    PuzzleFixtures,
    PuzzleNotFound,
    all_puzzles,
    find_puzzle,
    get_puzzle,
    list_puzzles,
    puzzle_injector,
    puzzle_ports,
    reload,
)

__all__ = [
    "CompletionCheck",
    "Puzzle",
    "PuzzleDetail",
    "PuzzleEdge",
    "PuzzleFixtures",
    "PuzzleNode",
    "PuzzleNotFound",
    "PuzzleSummary",
    "PuzzleWorkflow",
    "ScenarioSummary",
    "all_puzzles",
    "find_puzzle",
    "get_puzzle",
    "list_puzzles",
    "puzzle_injector",
    "puzzle_ports",
    "reload",
]
