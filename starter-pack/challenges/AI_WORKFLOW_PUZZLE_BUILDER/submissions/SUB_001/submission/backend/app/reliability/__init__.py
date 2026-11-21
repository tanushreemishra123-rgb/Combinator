"""Post-run reliability scoring and the run summary shown on the feedback screen.

:func:`app.reliability.scorer.score_run` turns a finished run - plus the puzzle
it was attempting, when there was one - into the ``ReliabilityReport`` shape
the frontend expects (``frontend/src/api/types.ts``).
"""

from __future__ import annotations

from app.reliability.scorer import (
    CompletionOutcome,
    ReliabilityReport,
    evaluate_check,
    score_run,
)

__all__ = [
    "CompletionOutcome",
    "ReliabilityReport",
    "evaluate_check",
    "score_run",
]
