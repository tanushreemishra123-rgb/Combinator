"""The seeded puzzle catalogue.

Responsibility: load every committed puzzle JSON in ``app/puzzles/data`` through
the strict models in :mod:`app.puzzles.models`, and hand the API layer two things:

* the catalogue - :func:`list_puzzles` (cards) and :func:`get_puzzle` (full
  definition, backend sections included);
* the per-puzzle **fixtures bundle** - :func:`puzzle_ports` - which carries the
  canned model responses, tool fixtures and retrieval fixtures a run of that
  puzzle needs, plus ready-made ports built from them.

Files are named ``<order>_<id>.json`` so the on-disk order matches the play
order. Loading happens once per process and is cached; :func:`reload` clears the
cache (used by tests and by anyone hand-editing a seed file).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.engine.ports import FailureInjector
from app.failures.injector import FailureScenario, NoOpFailureInjector, from_scenario
from app.providers.mock import MockModelProvider
from app.puzzles.models import Puzzle, PuzzleSummary
from app.tools.retrieval import FixtureRetrieval
from app.tools.simulator import SimulatedToolbox

DATA_DIR = Path(__file__).parent / "data"

_CACHE: dict[str, Puzzle] | None = None


class PuzzleNotFound(KeyError):
    """Raised when a puzzle id is not in the catalogue (API layer maps it to 404)."""


# --------------------------------------------------------------------- loading


def _load_all() -> dict[str, Puzzle]:
    """Parse every seed file, ordered by ``order`` then id."""
    puzzles: list[Puzzle] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:  # pragma: no cover - loud by design
            raise ValueError(f"{path.name} is not valid JSON: {exc}") from exc
        puzzle = Puzzle.model_validate(raw)
        if puzzle.id != path.stem.split("_", 1)[-1]:
            raise ValueError(
                f"{path.name} declares id {puzzle.id!r}; the file name must be "
                "'<order>_<id>.json'"
            )
        puzzles.append(puzzle)

    puzzles.sort(key=lambda item: (item.order, item.id))
    catalogue: dict[str, Puzzle] = {}
    for puzzle in puzzles:
        if puzzle.id in catalogue:
            raise ValueError(f"duplicate puzzle id {puzzle.id!r}")
        catalogue[puzzle.id] = puzzle
    return catalogue


def _catalogue() -> dict[str, Puzzle]:
    global _CACHE
    if _CACHE is None:
        _CACHE = _load_all()
    return _CACHE


def reload() -> dict[str, Puzzle]:
    """Forget the cached catalogue and read the seed files again."""
    global _CACHE
    _CACHE = None
    return _catalogue()


# ------------------------------------------------------------------- catalogue


def list_puzzles() -> list[PuzzleSummary]:
    """Every puzzle as a ``PuzzleSummary``-shaped card, in play order."""
    return [puzzle.summary() for puzzle in _catalogue().values()]


def all_puzzles() -> list[Puzzle]:
    """Every full puzzle definition, in play order (tests and tooling)."""
    return list(_catalogue().values())


def get_puzzle(puzzle_id: str) -> Puzzle:
    """The full definition for ``puzzle_id``, or raise :class:`PuzzleNotFound`."""
    try:
        return _catalogue()[puzzle_id]
    except KeyError as exc:
        raise PuzzleNotFound(puzzle_id) from exc


def find_puzzle(puzzle_id: str | None) -> Puzzle | None:
    """The full definition for ``puzzle_id``, or ``None`` when unknown/absent."""
    if not puzzle_id:
        return None
    return _catalogue().get(puzzle_id)


# --------------------------------------------------------------------- fixtures


@dataclass(slots=True)
class PuzzleFixtures:
    """Everything one puzzle needs to run in pure mock mode.

    The dicts are handed straight to Task 3's components: ``responses`` /
    ``responses_by_provider`` to :class:`~app.providers.mock.MockModelProvider`
    (or to ``ProviderSettings`` so a live Groq run keeps the same fallbacks),
    ``tool_fixtures`` to :class:`~app.tools.simulator.SimulatedToolbox` and
    ``retrieval_fixtures`` to :class:`~app.tools.retrieval.FixtureRetrieval`.
    """

    puzzle_id: str
    responses: dict[str, Any] = field(default_factory=dict)
    responses_by_provider: dict[str, dict[str, Any]] = field(default_factory=dict)
    tool_fixtures: dict[str, Any] = field(default_factory=dict)
    retrieval_fixtures: dict[str, Any] = field(default_factory=dict)

    def model_provider(self) -> MockModelProvider:
        """A deterministic mock model provider loaded with this puzzle's answers."""
        return MockModelProvider(
            self.responses, responses_by_provider=self.responses_by_provider
        )

    def toolbox(self) -> SimulatedToolbox:
        """The simulated toolbox loaded with this puzzle's tool fixtures."""
        return SimulatedToolbox(self.tool_fixtures)

    def retrieval(self) -> FixtureRetrieval:
        """The fixture-backed retrieval for this puzzle's knowledge bases."""
        return FixtureRetrieval(self.retrieval_fixtures)


def puzzle_ports(puzzle: Puzzle | str) -> PuzzleFixtures:
    """The fixtures bundle for ``puzzle`` (accepts a puzzle or its id)."""
    if isinstance(puzzle, str):
        puzzle = get_puzzle(puzzle)
    return PuzzleFixtures(
        puzzle_id=puzzle.id,
        responses=dict(puzzle.mock_responses),
        responses_by_provider={
            name: dict(table)
            for name, table in puzzle.mock_responses_by_provider.items()
        },
        tool_fixtures=dict(puzzle.tool_fixtures),
        retrieval_fixtures=dict(puzzle.retrieval_fixtures),
    )


def puzzle_injector(
    puzzle: Puzzle | str, scenario_id: str | None, *, enabled: bool = True
) -> FailureInjector:
    """The failure injector for one puzzle/scenario pair.

    ``scenario_id=None`` (the UI's failure toggle off) yields the no-op injector,
    and so does ``enabled=False`` - the shape a resume uses to replay a run once
    "the outage has passed".
    """
    if isinstance(puzzle, str):
        puzzle = get_puzzle(puzzle)
    scenario: FailureScenario | None = puzzle.scenario(scenario_id)
    if scenario is None or not enabled:
        return NoOpFailureInjector()
    return from_scenario(scenario)
