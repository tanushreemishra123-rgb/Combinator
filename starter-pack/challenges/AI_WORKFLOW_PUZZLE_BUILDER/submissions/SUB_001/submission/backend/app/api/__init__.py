"""HTTP API layer: puzzle routes, run streaming (SSE), human-review and mode-status endpoints."""

from app.api.puzzles import router as puzzles_router
from app.api.runs import router as runs_router
from app.api.workflows import router as workflows_router

#: Every router ``app.main`` mounts, in the order they appear in the contract.
ROUTERS = [puzzles_router, workflows_router, runs_router]

__all__ = ["ROUTERS", "puzzles_router", "runs_router", "workflows_router"]
