"""Puzzle definition models.

Responsibility: give every committed puzzle JSON file a *strict* shape. Every
model here forbids unknown keys, so a typo in a seed file ("compleiton_checks",
"retry_upsteam") fails loudly at import time rather than silently disabling a
puzzle's failure scenario at 2am during judging.

A puzzle file is the union of two things:

* the **public** contract (``PuzzleDetail``, mirrored by ``frontend/src/api/types.ts``) that the
  frontend renders: id/title/difficulty/tagline/concepts/order, objective,
  description, sample_input, expected_output, available_blocks,
  starter_workflow (with canvas positions), solution_hint, failure_scenarios and
  the human-readable ``completion_criteria``; and
* the **backend-only** sections the API never ships verbatim:
  ``completion_checks`` (machine-evaluable twins of the criteria, see
  :mod:`app.reliability.scorer`), ``mock_responses`` /
  ``mock_responses_by_provider`` (canned answers keyed by ``prompt_id``),
  ``tool_fixtures`` and ``retrieval_fixtures``.

:meth:`Puzzle.detail` and :meth:`Puzzle.summary` project the public halves;
``failure_scenarios`` are projected down to ``{id, label, description}`` so the
injector rules - which *are* the puzzle's answer key - never leave the server.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.engine.model import BlockType, WorkflowDef
from app.engine.trace import EventType
from app.failures.injector import ANY_NODE, FailureScenario

Difficulty = Literal["beginner", "intermediate", "advanced"]

#: Every kind the completion DSL understands. Kept deliberately small; the full
#: semantics live in :mod:`app.reliability.scorer`.
CheckKind = Literal[
    "run_status",
    "block_used",
    "event",
    "recovered",
    "output_field",
    "resumed",
    "validation_passed",
]

CompareOp = Literal["eq", "exists", "not_empty", "contains"]

#: Which extra keys each check kind is allowed (and, where listed, required) to carry.
_CHECK_KEYS: dict[str, tuple[frozenset[str], frozenset[str]]] = {
    #  kind                required             optional
    "run_status": (frozenset({"statuses"}), frozenset()),
    "block_used": (frozenset({"type"}), frozenset()),
    "event": (frozenset({"event"}), frozenset({"node_id"})),
    "recovered": (frozenset(), frozenset({"node_id", "recovery_action"})),
    "output_field": (frozenset({"field", "op"}), frozenset({"value"})),
    "resumed": (frozenset(), frozenset({"min_skipped"})),
    "validation_passed": (frozenset(), frozenset({"node_id"})),
}

_RUN_STATUSES = frozenset({"running", "completed", "failed", "paused", "safely_stopped"})


class CanvasPosition(BaseModel):
    """Where a block sits on the React Flow canvas. The engine ignores it."""

    model_config = ConfigDict(extra="forbid")

    x: float
    y: float


class PuzzleNode(BaseModel):
    """A block in a committed starter workflow, including its canvas position."""

    model_config = ConfigDict(extra="forbid")

    id: str
    type: BlockType
    label: str = ""
    #: Free-form per-block config; validated later by the block's own config model.
    config: dict[str, Any] = Field(default_factory=dict)
    position: CanvasPosition | None = None


class PuzzleEdge(BaseModel):
    """A connection between two blocks; ``sourceHandle`` marks condition branches."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    source: str
    target: str
    source_handle: Literal["true", "false"] | None = Field(
        default=None, alias="sourceHandle", serialization_alias="sourceHandle"
    )


class PuzzleWorkflow(BaseModel):
    """The starter graph exactly as the canvas will load it."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str = ""
    nodes: list[PuzzleNode] = Field(default_factory=list)
    edges: list[PuzzleEdge] = Field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Canvas-shaped JSON (``sourceHandle``, positions kept, enums as strings)."""
        return self.model_dump(mode="json", by_alias=True)

    def to_workflow_def(self) -> WorkflowDef:
        """The engine's :class:`WorkflowDef`; positions are dropped on the way in."""
        return WorkflowDef.model_validate(self.as_dict())

    @property
    def node_ids(self) -> set[str]:
        return {node.id for node in self.nodes}


class CompletionCheck(BaseModel):
    """One machine-evaluable completion criterion.

    Paired 1:1 (same order) with ``completion_criteria``, the sentences a player
    reads. See :mod:`app.reliability.scorer` for what each ``kind`` means.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    kind: CheckKind
    #: ``run_status``: the run statuses that count as a pass.
    statuses: list[str] | None = Field(
        default=None, alias="in", serialization_alias="in"
    )
    #: ``block_used``: the block type that must have been placed *and* executed.
    type: BlockType | None = None
    #: ``event``: the trace event that must appear.
    event: EventType | None = None
    #: ``event`` / ``recovered`` / ``validation_passed``: narrow to one node.
    node_id: str | None = None
    #: ``output_field``: dotted path into the run's result.
    field: str | None = None
    op: CompareOp | None = None
    value: Any = None
    #: ``resumed``: how many steps must have been reused from the earlier run.
    min_skipped: int | None = None
    #: ``recovered``: only these recovery actions count (e.g. ``["repair"]``).
    recovery_action: list[str] | None = None

    @model_validator(mode="after")
    def _check_shape(self) -> CompletionCheck:
        """Reject a check that carries keys its kind cannot use (or is missing one)."""
        required, optional = _CHECK_KEYS[self.kind]
        allowed = required | optional
        present = {
            name
            for name in (
                "statuses",
                "type",
                "event",
                "node_id",
                "field",
                "op",
                "value",
                "min_skipped",
                "recovery_action",
            )
            if getattr(self, name) is not None
        }
        missing = required - present
        if missing:
            raise ValueError(
                f"completion check {self.kind!r} needs {sorted(missing)}"
            )
        extra = present - allowed
        if extra:
            raise ValueError(
                f"completion check {self.kind!r} does not understand {sorted(extra)}"
            )
        if self.statuses is not None:
            unknown = sorted(set(self.statuses) - _RUN_STATUSES)
            if unknown:
                raise ValueError(f"unknown run status(es) {unknown}")
        return self


class PuzzleSummary(BaseModel):
    """The card shown on the puzzle-select screen."""

    id: str
    title: str
    difficulty: Difficulty
    tagline: str
    concepts: list[str] = Field(default_factory=list)
    order: int


class ScenarioSummary(BaseModel):
    """A failure scenario as the *frontend* sees it - never the rules."""

    id: str
    label: str
    description: str


class PuzzleDetail(PuzzleSummary):
    """Everything the builder screen needs to render one puzzle."""

    objective: str
    description: str
    sample_input: Any = None
    expected_output: str
    available_blocks: list[BlockType]
    starter_workflow: PuzzleWorkflow
    solution_hint: str = ""
    failure_scenarios: list[ScenarioSummary] = Field(default_factory=list)
    completion_criteria: list[str] = Field(default_factory=list)


class Puzzle(BaseModel):
    """One complete seeded puzzle: the public contract plus its fixtures."""

    model_config = ConfigDict(extra="forbid")

    # ------------------------------------------------------------------ public
    id: str
    title: str
    difficulty: Difficulty
    tagline: str
    concepts: list[str] = Field(default_factory=list)
    order: int
    objective: str
    description: str
    sample_input: Any = None
    expected_output: str
    available_blocks: list[BlockType]
    starter_workflow: PuzzleWorkflow
    solution_hint: str = ""
    failure_scenarios: list[FailureScenario] = Field(default_factory=list)
    completion_criteria: list[str] = Field(default_factory=list)

    # ------------------------------------------------------------ backend only
    completion_checks: list[CompletionCheck] = Field(default_factory=list)
    mock_responses: dict[str, Any] = Field(default_factory=dict)
    mock_responses_by_provider: dict[str, dict[str, Any]] = Field(default_factory=dict)
    tool_fixtures: dict[str, Any] = Field(default_factory=dict)
    retrieval_fixtures: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------- validation

    @model_validator(mode="after")
    def _cross_check(self) -> Puzzle:
        """Catch the mistakes that would otherwise only show up mid-demo."""
        if len(self.completion_checks) != len(self.completion_criteria):
            raise ValueError(
                f"puzzle {self.id!r}: {len(self.completion_criteria)} completion "
                f"criteria but {len(self.completion_checks)} checks; they pair 1:1"
            )
        node_ids = self.starter_workflow.node_ids
        for scenario in self.failure_scenarios:
            for rule in scenario.rules:
                if rule.node_id != ANY_NODE and rule.node_id not in node_ids:
                    raise ValueError(
                        f"puzzle {self.id!r}: scenario {scenario.id!r} targets unknown "
                        f"node {rule.node_id!r}"
                    )
        seen: set[str] = set()
        for scenario in self.failure_scenarios:
            if scenario.id in seen:
                raise ValueError(f"puzzle {self.id!r}: duplicate scenario {scenario.id!r}")
            seen.add(scenario.id)
        return self

    # ------------------------------------------------------------ projections

    def summary(self) -> PuzzleSummary:
        """The puzzle-select card."""
        return PuzzleSummary(
            id=self.id,
            title=self.title,
            difficulty=self.difficulty,
            tagline=self.tagline,
            concepts=list(self.concepts),
            order=self.order,
        )

    def detail(self) -> PuzzleDetail:
        """The full public payload - with the injector rules stripped out."""
        return PuzzleDetail(
            **self.summary().model_dump(),
            objective=self.objective,
            description=self.description,
            sample_input=self.sample_input,
            expected_output=self.expected_output,
            available_blocks=list(self.available_blocks),
            starter_workflow=self.starter_workflow,
            solution_hint=self.solution_hint,
            failure_scenarios=[
                ScenarioSummary(
                    id=item.id, label=item.label, description=item.description
                )
                for item in self.failure_scenarios
            ],
            completion_criteria=list(self.completion_criteria),
        )

    # ---------------------------------------------------------------- helpers

    def workflow(self) -> WorkflowDef:
        """A fresh engine workflow built from the starter graph."""
        return self.starter_workflow.to_workflow_def()

    def scenario(self, scenario_id: str | None) -> FailureScenario | None:
        """Look up one committed scenario by id (``None`` → no scenario)."""
        if scenario_id is None:
            return None
        for item in self.failure_scenarios:
            if item.id == scenario_id:
                return item
        return None

    @property
    def default_scenario(self) -> FailureScenario | None:
        """The scenario the UI pre-selects: the first one committed."""
        return self.failure_scenarios[0] if self.failure_scenarios else None

    @property
    def prompt_ids(self) -> list[str]:
        """Every ``prompt_id`` the starter workflow asks the model for."""
        return [
            str(node.config["prompt_id"])
            for node in self.starter_workflow.nodes
            if node.type is BlockType.AI_MODEL and node.config.get("prompt_id")
        ]
