"""The reliability scorer: counts, grades, score, and the completion DSL."""

from __future__ import annotations

from typing import Any

import pytest
from conftest import (
    FakeModelPort,
    FakeToolPort,
    ScriptedInjector,
    node,
    workflow,
)
from pydantic import ValidationError

from app.engine.errors import ModelFailure
from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind, FailurePlan
from app.engine.run import RunState, RunStatus
from app.puzzles.models import CompletionCheck, Puzzle
from app.reliability.scorer import ReliabilityReport, evaluate_check, score_run

CONTRACT_FIELDS = {
    "run_id",
    "puzzle_id",
    "grade",
    "score",
    "completed",
    "output_valid",
    "injected_failure_handled",
    "retries_used",
    "repairs_used",
    "fallback_used",
    "human_review_used",
    "safe_stop_used",
    "unhandled_errors",
    "strengths",
    "weaknesses",
    "completion",
    "puzzle_solved",
}


# ------------------------------------------------------------------- builders


def tiny_puzzle(
    checks: list[dict[str, Any]],
    criteria: list[str] | None = None,
    **overrides: Any,
) -> Puzzle:
    """A throwaway puzzle carrying just the completion criteria under test."""
    criteria = criteria or [f"criterion {index}" for index in range(len(checks))]
    definition: dict[str, Any] = {
        "id": "test-puzzle",
        "title": "Test puzzle",
        "difficulty": "beginner",
        "tagline": "For the scorer",
        "concepts": [],
        "order": 99,
        "objective": "Exercise the scorer.",
        "description": "Not a seeded puzzle.",
        "sample_input": None,
        "expected_output": "Anything.",
        "available_blocks": ["input", "output"],
        "starter_workflow": {
            "id": "wf_tiny",
            "name": "Tiny",
            "nodes": [
                {"id": "input", "type": "input"},
                {"id": "out", "type": "output"},
            ],
            "edges": [{"id": "e1", "source": "input", "target": "out"}],
        },
        "completion_criteria": criteria,
        "completion_checks": checks,
    }
    definition.update(overrides)
    return Puzzle.model_validate(definition)


def bare_run(**overrides: Any) -> RunState:
    """A run state with no trace, for testing checks that only read the result."""
    graph = workflow([node("input", BlockType.INPUT), node("out", BlockType.OUTPUT)])
    return RunState(run_id="run_bare", workflow=graph, **overrides)


def guarded_workflow(on_fail: str = "fail"):
    """Input -> Retry -> AI -> Validator -> Output: checked *and* protected."""
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("guard", BlockType.RETRY, max_attempts=2),
            node("ai", BlockType.AI_MODEL, prompt="Answer", output_field="answer"),
            node(
                "check",
                BlockType.VALIDATOR,
                schema={"answer": {"type": "string", "min": 2}},
                on_fail=on_fail,
            ),
            node("out", BlockType.OUTPUT),
        ]
    )


def bare_workflow():
    """Input -> AI -> Output: nothing checks it, nothing protects it."""
    return workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Answer", output_field="answer"),
            node("out", BlockType.OUTPUT),
        ]
    )


async def run(graph, *, model=None, tool=None, retrieval=None, injector=None, data=None):
    executor = WorkflowExecutor(
        model=model or FakeModelPort("a good answer"),
        tool=tool,
        retrieval=retrieval,
        injector=injector,
    )
    return executor, await executor.start_run(graph, data)


# ------------------------------------------------------------ contract shape


def test_report_matches_the_frozen_contract_fields():
    assert set(ReliabilityReport.model_fields) == CONTRACT_FIELDS


async def test_a_run_without_a_puzzle_reports_no_puzzle_and_no_criteria():
    _, state = await run(guarded_workflow())

    report = score_run(state)

    assert report.puzzle_id is None
    assert report.completion == []
    assert report.puzzle_solved is False
    assert report.run_id == state.run_id


# ------------------------------------------------------------------- counting


async def test_retries_fallbacks_reviews_and_safe_stops_are_counted():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.MODEL_ERROR, detail={"message": "down"})}
    )
    _, state = await run(guarded_workflow(), injector=injector)

    report = score_run(state)

    assert report.retries_used == 1
    assert report.fallback_used is False
    assert report.human_review_used is False
    assert report.safe_stop_used is False
    assert report.completed is True


async def test_a_fallback_to_another_provider_is_recorded():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node(
                "fb",
                BlockType.FALLBACK,
                mode="alternate_provider",
                provider="backup",
            ),
            node("ai", BlockType.AI_MODEL, prompt="Answer", output_field="answer"),
            node(
                "check",
                BlockType.VALIDATOR,
                schema={"answer": {"type": "string"}},
                on_fail="fail",
            ),
            node("out", BlockType.OUTPUT),
        ]
    )
    model = FakeModelPort(provider_responses={"backup": "written by the backup"})

    _, state = await run(graph, model=model)

    report = score_run(state, scenario_enabled=False)

    assert state.status is RunStatus.COMPLETED
    assert report.fallback_used is True
    assert any("backup" in item for item in report.strengths)


async def test_a_human_decision_and_a_safe_stop_are_recorded():
    graph = workflow(
        [node("input", BlockType.INPUT), node("ai", BlockType.AI_MODEL, prompt="Draft", output_field="draft"), node("review", BlockType.HUMAN_REVIEW, prompt="Approve?"), node("out", BlockType.OUTPUT), node("stop", BlockType.SAFE_STOP, message="Rejected.")],
        edges=[
            {"id": "e1", "source": "input", "target": "ai"},
            {"id": "e2", "source": "ai", "target": "review"},
            {"id": "e3", "source": "review", "target": "out"},
        ],
    )
    executor = WorkflowExecutor(model=FakeModelPort("a draft"))
    paused = await executor.start_run(graph, None)
    state = await executor.resume_run(paused.run_id, {"action": "reject", "note": "no"})

    report = score_run(state)

    assert report.human_review_used is True
    assert report.safe_stop_used is True
    assert report.completed is False
    assert any("rejected" in item for item in report.strengths)


async def test_output_valid_is_null_when_no_validator_ran():
    _, state = await run(bare_workflow())

    assert score_run(state).output_valid is None


async def test_output_valid_follows_the_last_validator_to_speak():
    _, passing = await run(guarded_workflow())
    _, failing = await run(guarded_workflow(), model=FakeModelPort(12345))

    assert score_run(passing).output_valid is True
    assert score_run(failing).output_valid is False


async def test_unhandled_errors_name_the_kind_the_run_died_on():
    model = FakeModelPort(ModelFailure("the provider is gone"))

    _, state = await run(bare_workflow(), model=model)

    report = score_run(state)

    assert report.unhandled_errors == ["model_error"]
    assert any("model outage" in item for item in report.weaknesses)


# ------------------------------------------------- handling injected failures


async def test_injected_failure_handled_is_null_when_nothing_was_staged():
    _, state = await run(guarded_workflow())

    assert score_run(state, scenario_enabled=False).injected_failure_handled is None


async def test_injected_failure_handled_is_false_when_nothing_reacted():
    """A staged failure that sails straight through was not handled."""
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.LOW_CONFIDENCE, detail={"confidence": 0.1})}
    )
    _, state = await run(bare_workflow(), injector=injector)

    report = score_run(state, scenario_enabled=True)

    assert state.status is RunStatus.COMPLETED
    assert report.injected_failure_handled is False
    assert report.grade == "fragile"


async def test_injected_failure_handled_is_true_when_a_retry_rescued_the_run():
    injector = ScriptedInjector(
        {("ai", 1): FailurePlan(kind=FailureKind.TIMEOUT, detail={"message": "slow"})}
    )
    _, state = await run(guarded_workflow(), injector=injector)

    report = score_run(state, scenario_enabled=True)

    assert report.injected_failure_handled is True
    assert any("attempt 2" in item for item in report.strengths)


async def test_a_failed_run_never_counts_as_handled():
    injector = ScriptedInjector(
        {
            ("ai", 1): FailurePlan(kind=FailureKind.MODEL_ERROR),
            ("ai", 2): FailurePlan(kind=FailureKind.MODEL_ERROR),
        }
    )
    _, state = await run(guarded_workflow(), injector=injector)

    report = score_run(state, scenario_enabled=True)

    assert state.status is RunStatus.FAILED
    assert report.injected_failure_handled is False


# --------------------------------------------------------------------- grades


async def test_a_failed_run_is_broken():
    _, state = await run(bare_workflow(), model=FakeModelPort(ModelFailure("gone")))

    report = score_run(state, scenario_enabled=True)

    assert report.grade == "broken"
    assert report.score < 40


async def test_an_unchecked_unprotected_run_is_fragile():
    _, state = await run(bare_workflow())

    report = score_run(state, scenario_enabled=False)

    assert report.grade == "fragile"
    assert any("Nothing checks" in item for item in report.weaknesses)
    assert any("No Retry" in item for item in report.weaknesses)


async def test_a_clean_checked_and_protected_run_is_resilient():
    _, state = await run(guarded_workflow())

    report = score_run(state, scenario_enabled=False)

    assert report.grade == "resilient"
    assert report.weaknesses == []
    assert report.score >= 85


async def test_leaning_on_a_backup_provider_is_only_recovered():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("fb", BlockType.FALLBACK, mode="alternate_provider", provider="backup"),
            node("ai", BlockType.AI_MODEL, prompt="Answer", output_field="answer"),
            node(
                "check",
                BlockType.VALIDATOR,
                schema={"answer": {"type": "string"}},
                on_fail="fail",
            ),
            node("out", BlockType.OUTPUT),
        ]
    )
    model = FakeModelPort(provider_responses={"backup": "the backup wrote this"})

    _, state = await run(graph, model=model)

    report = score_run(state, scenario_enabled=True)

    assert report.grade == "recovered"
    assert any("backup provider" in item for item in report.weaknesses)


async def test_a_safe_stop_that_misses_the_goal_is_fragile():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("stop", BlockType.SAFE_STOP, message="Not today."),
        ]
    )
    puzzle = tiny_puzzle([{"kind": "run_status", "in": ["completed"]}])

    _, state = await run(graph)

    report = score_run(state, puzzle, scenario_enabled=False)

    assert state.status is RunStatus.SAFELY_STOPPED
    assert report.puzzle_solved is False
    assert report.grade == "fragile"


async def test_a_safe_stop_that_is_the_goal_is_resilient():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("stop", BlockType.SAFE_STOP, message="Refusing without evidence."),
        ]
    )
    puzzle = tiny_puzzle([{"kind": "run_status", "in": ["safely_stopped"]}])

    _, state = await run(graph)

    report = score_run(state, puzzle, scenario_enabled=True)

    assert report.puzzle_solved is True
    assert report.grade == "resilient"
    assert report.safe_stop_used is True


# ---------------------------------------------------------------------- score


async def test_score_is_bounded_and_tracks_the_grade():
    _, broken = await run(bare_workflow(), model=FakeModelPort(ModelFailure("gone")))
    _, fragile = await run(bare_workflow())
    _, resilient = await run(guarded_workflow())

    scores = [
        score_run(broken, scenario_enabled=True).score,
        score_run(fragile, scenario_enabled=False).score,
        score_run(resilient, scenario_enabled=False).score,
    ]

    assert all(0 <= value <= 100 for value in scores)
    assert scores == sorted(scores)


# ------------------------------------------------------------- completion DSL


async def test_run_status_check_matches_any_listed_status():
    _, state = await run(guarded_workflow())

    assert evaluate_check(
        CompletionCheck.model_validate({"kind": "run_status", "in": ["completed"]}), state
    )
    assert not evaluate_check(
        CompletionCheck.model_validate({"kind": "run_status", "in": ["failed"]}), state
    )


async def test_block_used_check_needs_the_block_to_have_actually_run():
    """A Validator the run never reached cannot pass its own criterion."""
    _, finished = await run(guarded_workflow())
    _, died_early = await run(
        guarded_workflow(), model=FakeModelPort(ModelFailure("gone"))
    )
    check = CompletionCheck.model_validate({"kind": "block_used", "type": "validator"})

    assert evaluate_check(check, finished)
    assert not evaluate_check(check, died_early)


async def test_block_used_check_fails_when_the_block_is_not_on_the_canvas():
    _, state = await run(bare_workflow())

    assert not evaluate_check(
        CompletionCheck.model_validate({"kind": "block_used", "type": "retry"}), state
    )


async def test_event_check_can_be_narrowed_to_one_node():
    injector = ScriptedInjector({("ai", 1): FailurePlan(kind=FailureKind.TIMEOUT)})
    _, state = await run(guarded_workflow(), injector=injector)

    assert evaluate_check(
        CompletionCheck.model_validate({"kind": "event", "event": "step_retrying"}), state
    )
    assert evaluate_check(
        CompletionCheck.model_validate(
            {"kind": "event", "event": "step_retrying", "node_id": "ai"}
        ),
        state,
    )
    assert not evaluate_check(
        CompletionCheck.model_validate(
            {"kind": "event", "event": "step_retrying", "node_id": "check"}
        ),
        state,
    )


async def test_recovered_check_spots_the_node_that_came_back():
    injector = ScriptedInjector({("ai", 1): FailurePlan(kind=FailureKind.TIMEOUT)})
    _, recovered = await run(guarded_workflow(), injector=injector)
    _, untroubled = await run(guarded_workflow())

    check = CompletionCheck.model_validate({"kind": "recovered", "node_id": "ai"})

    assert evaluate_check(check, recovered)
    assert evaluate_check(CompletionCheck.model_validate({"kind": "recovered"}), recovered)
    assert not evaluate_check(check, untroubled)


@pytest.mark.parametrize(
    "check,expected",
    [
        ({"kind": "output_field", "field": "name", "op": "exists"}, True),
        ({"kind": "output_field", "field": "missing", "op": "exists"}, False),
        ({"kind": "output_field", "field": "empty", "op": "exists"}, True),
        ({"kind": "output_field", "field": "empty", "op": "not_empty"}, False),
        ({"kind": "output_field", "field": "name", "op": "not_empty"}, True),
        ({"kind": "output_field", "field": "nested.count", "op": "eq", "value": 3}, True),
        ({"kind": "output_field", "field": "nested.count", "op": "eq", "value": 4}, False),
        ({"kind": "output_field", "field": "name", "op": "contains", "value": "BACK"}, True),
        ({"kind": "output_field", "field": "tags", "op": "contains", "value": "b"}, True),
        ({"kind": "output_field", "field": "tags", "op": "contains", "value": "z"}, False),
    ],
)
def test_output_field_check_operators(check: dict[str, Any], expected: bool):
    state = bare_run(
        status=RunStatus.COMPLETED,
        result={
            "name": "backup model",
            "empty": [],
            "nested": {"count": 3},
            "tags": ["a", "b"],
        },
    )

    assert evaluate_check(CompletionCheck.model_validate(check), state) is expected


async def test_resumed_check_counts_the_steps_that_were_reused():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL, prompt="Plan", output_field="plan"),
            node("send", BlockType.TOOL, tool="relay", output_field="receipt"),
            node("out", BlockType.OUTPUT),
        ]
    )
    injector = ScriptedInjector({("send", 1): FailurePlan(kind=FailureKind.TOOL_ERROR)})
    executor = WorkflowExecutor(
        model=FakeModelPort("a plan"),
        tool=FakeToolPort({"delivered": True}),
        injector=injector,
    )
    failed = await executor.start_run(graph, {"mission": "go"})
    injector.enabled = False
    resumed = await executor.resume_from_last_successful(failed.run_id)

    assert not evaluate_check(CompletionCheck.model_validate({"kind": "resumed"}), failed)
    assert evaluate_check(CompletionCheck.model_validate({"kind": "resumed"}), resumed)
    assert evaluate_check(
        CompletionCheck.model_validate({"kind": "resumed", "min_skipped": 2}), resumed
    )
    assert not evaluate_check(
        CompletionCheck.model_validate({"kind": "resumed", "min_skipped": 5}), resumed
    )


async def test_validation_passed_check_reads_the_last_word_of_a_validator():
    _, passing = await run(guarded_workflow())
    _, failing = await run(guarded_workflow(), model=FakeModelPort(12345))
    _, novalidator = await run(bare_workflow())

    check = CompletionCheck.model_validate(
        {"kind": "validation_passed", "node_id": "check"}
    )

    assert evaluate_check(check, passing)
    assert not evaluate_check(check, failing)
    assert not evaluate_check(check, novalidator)


async def test_puzzle_solved_requires_every_criterion_and_reports_each_one():
    puzzle = tiny_puzzle(
        [
            {"kind": "run_status", "in": ["completed"]},
            {"kind": "block_used", "type": "fallback"},
        ],
        ["The run finishes", "A fallback stands behind the model"],
    )
    _, state = await run(guarded_workflow())

    report = score_run(state, puzzle, scenario_enabled=False)

    assert [item.criterion for item in report.completion] == [
        "The run finishes",
        "A fallback stands behind the model",
    ]
    assert [item.met for item in report.completion] == [True, False]
    assert report.puzzle_solved is False


async def test_a_solved_puzzle_scores_higher_than_an_unsolved_one():
    solved = tiny_puzzle([{"kind": "run_status", "in": ["completed"]}])
    unsolved = tiny_puzzle([{"kind": "run_status", "in": ["failed"]}])
    _, state = await run(guarded_workflow())

    assert (
        score_run(state, solved).score > score_run(state, unsolved).score
    )


# ------------------------------------------------- the DSL fails loudly on typos


@pytest.mark.parametrize(
    "check",
    [
        {"kind": "run_status"},
        {"kind": "run_status", "in": ["finished"]},
        {"kind": "block_used"},
        {"kind": "event"},
        {"kind": "output_field", "field": "x"},
        {"kind": "output_field", "op": "eq", "value": 1},
        {"kind": "resumed", "type": "retry"},
        {"kind": "validation_passed", "field": "x", "op": "eq", "value": 1},
        {"kind": "recovered", "nodeid": "ai"},
        {"kind": "event", "event": "run_completed", "recovery_action": ["repair"]},
        {"kind": "retry_upsteam"},
    ],
)
def test_a_malformed_completion_check_is_rejected(check: dict[str, Any]):
    with pytest.raises(ValidationError):
        CompletionCheck.model_validate(check)


def test_criteria_and_checks_must_pair_one_to_one():
    with pytest.raises(ValidationError, match="pair 1:1"):
        tiny_puzzle(
            [{"kind": "run_status", "in": ["completed"]}],
            ["one criterion", "but two sentences"],
        )


def test_a_scenario_pointing_at_an_unknown_node_is_rejected():
    with pytest.raises(ValidationError, match="unknown node"):
        tiny_puzzle(
            [{"kind": "run_status", "in": ["completed"]}],
            failure_scenarios=[
                {
                    "id": "typo",
                    "label": "Typo",
                    "description": "Targets a block that is not there.",
                    "rules": [{"node_id": "inpt", "kind": "timeout"}],
                }
            ],
        )


def test_two_scenarios_may_not_share_an_id():
    scenario = {"id": "same", "label": "A", "description": "B", "rules": []}
    with pytest.raises(ValidationError, match="duplicate scenario"):
        tiny_puzzle(
            [{"kind": "run_status", "in": ["completed"]}],
            failure_scenarios=[scenario, dict(scenario)],
        )


def test_an_unknown_key_in_a_seed_file_is_rejected():
    with pytest.raises(ValidationError):
        tiny_puzzle([{"kind": "run_status", "in": ["completed"]}], solutoin_hint="typo")


# ------------------------------------------------------------ repair rounds


async def repair_run() -> RunState:
    model = FakeModelPort(responses=["x", "a good answer"])
    return await WorkflowExecutor(model=model).start_run(guarded_workflow(on_fail="repair"), {"q": 1})


async def safe_default_run() -> RunState:
    model = FakeModelPort("x")
    graph = guarded_workflow(on_fail="safe_default")
    for item in graph.nodes:
        if item.id == "check":
            item.config["safe_default"] = {"answer": "a safe answer"}
    return await WorkflowExecutor(model=model).start_run(graph, {"q": 1})


async def test_a_repair_is_a_rescue_and_reads_as_a_strength():
    state = await repair_run()

    report = score_run(state, scenario_enabled=True)

    assert state.status.value == "completed"
    assert report.injected_failure_handled is True
    assert report.repairs_used == 1
    assert report.retries_used == 0
    assert report.output_valid is True
    assert report.grade == "resilient"
    spoken = [line for line in report.strengths if "corrected answer passed" in line]
    assert len(spoken) == 1
    assert "sent the answer back to Ai" in spoken[0]


async def test_recovered_check_can_be_narrowed_by_recovery_action():
    narrowed = tiny_puzzle([{"kind": "recovered", "node_id": "check", "recovery_action": ["repair"]}])
    loose = tiny_puzzle([{"kind": "recovered", "node_id": "check"}])
    repaired = await repair_run()
    defaulted = await safe_default_run()

    assert score_run(repaired, narrowed).completion[0].met is True
    assert score_run(defaulted, narrowed).completion[0].met is False
    assert score_run(defaulted, loose).completion[0].met is True
