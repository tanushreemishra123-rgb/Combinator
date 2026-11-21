"""Aggregates the v1 routers."""

from fastapi import APIRouter

from app.api.v1 import (
    analysis,
    artifacts,
    changes,
    documents,
    estimation,
    package,
    quality,
    scenarios,
    scope,
    sessions,
    system,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(system.router)
api_router.include_router(scenarios.router)
api_router.include_router(estimation.reference_router)
api_router.include_router(sessions.router)
api_router.include_router(documents.router)
api_router.include_router(scope.router)
api_router.include_router(analysis.router)
api_router.include_router(artifacts.router)
api_router.include_router(estimation.router)
api_router.include_router(changes.router)
api_router.include_router(quality.router)
api_router.include_router(package.router)
