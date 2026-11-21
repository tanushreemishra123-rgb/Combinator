"""Deterministic failure injection.

Responsibility: decide - purely from a declarative scenario - whether a given
step attempt should fail, so that "watch the workflow break, then fix it" is
reproducible for every reviewer, on every machine, on every run.

The executor consults the injector *before* the block runs, passing the
**cumulative invocation count** for that node in that run (attempt 1, 2, 3 ...
counting retries *and* fallback attempts). Raising kinds abort the attempt with a
typed engine error; degrading kinds let the step run and then spoil its output so
a Validator can catch it (see ``app.engine.ports.RAISING_KINDS`` /
``DEGRADING_KINDS``).

Scenario format (committed inside each puzzle definition)::

    {
      "id": "timeout_storm",
      "label": "Research tool times out",
      "description": "The research API hangs on the first two attempts.",
      "enabled": true,                        # optional, default true
      "rules": [
        {
          "node_id": "research_1",            # "*" matches every node
          "kind": "timeout",                  # any FailureKind value
          "attempts": [1, 2],                 # invocations that fail; or "all"
          "first_n": 2,                       # sugar for attempts [1..n]
          "label": "hang the research call",  # optional, author-facing
          "detail": {"message": "The research API did not respond."}
        }
      ]
    }

Rules:

* ``kind`` - one of ``timeout``, ``invalid_json``, ``missing_field``,
  ``tool_error``, ``empty_retrieval``, ``low_confidence``, ``model_error``.
* ``attempts`` - a list of 1-based invocation numbers, or the string ``"all"``.
  Defaults to ``"all"`` (the node always fails - the right default for a
  scenario that a Fallback block is meant to rescue).
* ``first_n`` - convenience for ``attempts: [1, ..., n]``; exactly the shape a
  "retry recovers on attempt 3" puzzle needs (``first_n: 2`` with
  ``max_attempts: 3``).
* ``detail`` - merged into the :class:`FailurePlan`; ``detail["message"]``
  becomes the error message, and the remaining keys drive the degrading kinds
  (``{"field": "owner"}`` for ``missing_field``, ``{"confidence": 0.2}`` for
  ``low_confidence``).

The first matching rule wins, so put the specific rules first.

**Statelessness matters.** ``should_fail`` ignores ``run_id`` and keeps no
counters: two runs of the same scenario fail in exactly the same places, which is
what makes "resume from the last successful step" demonstrable. Because a resumed
run restarts its per-node invocation counters, callers replay a resume with
:func:`off` (or :meth:`ScenarioFailureInjector.disabled`) to show the mission
completing the second time.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.engine.ports import FailureKind, FailurePlan

ALL_ATTEMPTS = "all"
ANY_NODE = "*"


class FailureRule(BaseModel):
    """One staged failure: *which node*, *which attempts*, *what goes wrong*."""

    model_config = ConfigDict(extra="forbid")

    node_id: str = ANY_NODE
    kind: FailureKind
    attempts: list[int] | Literal["all"] = ALL_ATTEMPTS
    first_n: int | None = Field(default=None, ge=1)
    label: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _expand_first_n(self) -> FailureRule:
        """``first_n: 2`` is sugar for ``attempts: [1, 2]``."""
        if self.first_n is not None:
            self.attempts = list(range(1, self.first_n + 1))
        return self

    def matches(self, node_id: str, attempt: int) -> bool:
        """Whether this rule fires for ``(node_id, cumulative attempt)``."""
        if self.node_id != ANY_NODE and self.node_id != node_id:
            return False
        if self.attempts == ALL_ATTEMPTS:
            return True
        return attempt in self.attempts

    def plan(self) -> FailurePlan:
        """The :class:`FailurePlan` the engine acts on."""
        return FailurePlan(kind=self.kind, detail=dict(self.detail))


class FailureScenario(BaseModel):
    """A named, user-facing bundle of rules - the puzzle's "what goes wrong"."""

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str = ""
    description: str = ""
    enabled: bool = True
    rules: list[FailureRule] = Field(default_factory=list)

    @property
    def node_ids(self) -> list[str]:
        """Nodes this scenario touches (for UI highlighting)."""
        seen: list[str] = []
        for rule in self.rules:
            if rule.node_id not in seen:
                seen.append(rule.node_id)
        return seen


class ScenarioFailureInjector:
    """A :class:`~app.engine.ports.FailureInjector` driven by a scenario dict.

    Deterministic and stateless: the same ``(node_id, attempt)`` always produces
    the same answer, regardless of run id or call order.
    """

    def __init__(self, scenario: FailureScenario) -> None:
        self.scenario = scenario

    @classmethod
    def from_scenario(
        cls, scenario: FailureScenario | dict[str, Any] | None
    ) -> ScenarioFailureInjector | NoOpFailureInjector:
        """Build an injector from a committed scenario dict.

        ``None`` (no scenario selected, or the UI's failure toggle switched off)
        yields the no-op injector. Raises ``pydantic.ValidationError`` on a
        malformed scenario, so a typo in a puzzle definition fails loudly.
        """
        if scenario is None:
            return NoOpFailureInjector()
        if not isinstance(scenario, FailureScenario):
            scenario = FailureScenario.model_validate(scenario)
        return cls(scenario)

    @property
    def scenario_id(self) -> str:
        return self.scenario.id

    @property
    def enabled(self) -> bool:
        return self.scenario.enabled

    def should_fail(self, run_id: str, node_id: str, attempt: int) -> FailurePlan | None:
        """Return the first matching rule's plan, or ``None`` to let the step run."""
        if not self.scenario.enabled:
            return None
        for rule in self.scenario.rules:
            if rule.matches(node_id, attempt):
                return rule.plan()
        return None

    def disabled(self) -> ScenarioFailureInjector:
        """A copy that stages nothing - used to replay a run cleanly (resume)."""
        return ScenarioFailureInjector(self.scenario.model_copy(update={"enabled": False}))


class NoOpFailureInjector:
    """Stages nothing. The "failures off" position of the UI toggle."""

    scenario: FailureScenario | None = None
    scenario_id: str | None = None
    enabled = False

    def should_fail(self, run_id: str, node_id: str, attempt: int) -> FailurePlan | None:
        return None


def off() -> NoOpFailureInjector:
    """The no-op injector: every step gets its honest chance to succeed."""
    return NoOpFailureInjector()


def from_scenario(
    scenario: FailureScenario | dict[str, Any] | None,
) -> ScenarioFailureInjector | NoOpFailureInjector:
    """Module-level shorthand for :meth:`ScenarioFailureInjector.from_scenario`."""
    return ScenarioFailureInjector.from_scenario(scenario)
