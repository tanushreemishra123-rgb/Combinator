"""Deterministic failure injection: timeout, invalid JSON, missing field, empty retrieval,
low confidence, tool failure and model failure, staged from a declarative scenario."""

from app.failures.injector import (
    FailureRule,
    FailureScenario,
    NoOpFailureInjector,
    ScenarioFailureInjector,
    from_scenario,
    off,
)

__all__ = [
    "FailureRule",
    "FailureScenario",
    "NoOpFailureInjector",
    "ScenarioFailureInjector",
    "from_scenario",
    "off",
]
