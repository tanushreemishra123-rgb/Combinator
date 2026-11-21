"""Shared FastAPI dependencies.

Responsibility: hand every handler the one process-wide :class:`RunRegistry`
(and, through it, the one shared run store). It is created in ``app.main``'s
lifespan, but built on demand here too so an ASGI transport that never runs
lifespan events - every test in ``backend/tests`` - still gets a registry.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.api.context import RunRegistry


def get_registry(request: Request) -> RunRegistry:
    """The application's run registry, created on first use."""
    registry = getattr(request.app.state, "runs", None)
    if registry is None:
        registry = RunRegistry()
        request.app.state.runs = registry
    return registry


RegistryDep = Annotated[RunRegistry, Depends(get_registry)]
