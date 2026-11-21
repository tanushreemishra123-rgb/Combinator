"""Scenario-driven failure injection: rule matching plus end-to-end determinism."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.ports import FailureKind
from app.engine.run import RunStatus
from app.failures.injector import (
    FailureScenario,
    NoOpFailureInjector,
    ScenarioFailureInjector,
    from_scenario,
    off,
)
from app.providers.mock import MockModelProvider
from app.tools.simulator import SimulatedToolbox
from tests.conftest import node, workflow

TIMEOUT_STORM = {
    "id": "timeout_storm",
    "label": "The research API hangs",
    "description": "The research call times out on its first two attempts.",
    "rules": [
        {
            "node_id": "research_1",
            "kind": "timeout",
            "attempts": [1, 2],
            "detail": {"message": "The research API did not respond."},
        }
    ],
}


# ------------------------------------------------------------------ rule matching


def test_a_rule_fires_only_on_its_listed_attempts():
    injector = from_scenario(TIMEOUT_STORM)

    assert injector.should_fail("run_1", "research_1", 1).kind is FailureKind.TIMEOUT
    assert injector.should_fail("run_1", "research_1", 2) is not None
    assert injector.should_fail("run_1", "research_1", 3) is None


def test_a_rule_ignores_other_nodes():
    injector = from_scenario(TIMEOUT_STORM)

    assert injector.should_fail("run_1", "summarise_1", 1) is None


def test_the_plan_carries_the_authored_detail():
    plan = from_scenario(TIMEOUT_STORM).should_fail("run_1", "research_1", 1)

    assert plan.detail == {"message": "The research API did not respond."}
    assert plan.raises is True


def test_attempts_all_fails_every_invocation():
    injector = from_scenario(
        {
            "id": "provider_outage",
            "rules": [{"node_id": "draft_1", "kind": "model_error", "attempts": "all"}],
        }
    )

    assert all(injector.should_fail("run_1", "draft_1", n) for n in (1, 2, 7, 99))


def test_attempts_defaults_to_all():
    injector = from_scenario(
        {"id": "s", "rules": [{"node_id": "draft_1", "kind": "model_error"}]}
    )

    assert injector.should_fail("run_1", "draft_1", 4) is not None


def test_first_n_is_sugar_for_attempts_one_to_n():
    injector = from_scenario(
        {"id": "s", "rules": [{"node_id": "extract_1", "kind": "invalid_json", "first_n": 2}]}
    )

    assert injector.should_fail("run_1", "extract_1", 1) is not None
    assert injector.should_fail("run_1", "extract_1", 2) is not None
    assert injector.should_fail("run_1", "extract_1", 3) is None
    assert FailureScenario.model_validate(
        {"id": "s", "rules": [{"node_id": "x", "kind": "timeout", "first_n": 3}]}
    ).rules[0].attempts == [1, 2, 3]


def test_a_wildcard_node_id_matches_every_node():
    injector = from_scenario(
        {"id": "s", "rules": [{"node_id": "*", "kind": "tool_error", "first_n": 1}]}
    )

    assert injector.should_fail("run_1", "anything", 1) is not None
    assert injector.should_fail("run_1", "something_else", 1) is not None
    assert injector.should_fail("run_1", "anything", 2) is None


def test_the_first_matching_rule_wins():
    injector = from_scenario(
        {
            "id": "s",
            "rules": [
                {"node_id": "n", "kind": "low_confidence", "first_n": 1, "detail": {"confidence": 0.1}},
                {"node_id": "*", "kind": "model_error"},
            ],
        }
    )

    assert injector.should_fail("run_1", "n", 1).kind is FailureKind.LOW_CONFIDENCE
    assert injector.should_fail("run_1", "n", 2).kind is FailureKind.MODEL_ERROR


def test_a_disabled_scenario_stages_nothing():
    injector = from_scenario({**TIMEOUT_STORM, "enabled": False})

    assert injector.should_fail("run_1", "research_1", 1) is None
    assert from_scenario(TIMEOUT_STORM).disabled().should_fail("r", "research_1", 1) is None


def test_the_injector_is_stateless_across_runs_and_repeats():
    injector = from_scenario(TIMEOUT_STORM)

    first = injector.should_fail("run_a", "research_1", 1)
    again = injector.should_fail("run_b", "research_1", 1)

    assert first.model_dump() == again.model_dump()


def test_no_scenario_means_the_no_op_injector():
    injector = from_scenario(None)

    assert isinstance(injector, NoOpFailureInjector)
    assert injector.should_fail("run_1", "any", 1) is None
    assert off().should_fail("run_1", "any", 1) is None


def test_scenario_metadata_is_exposed_for_the_ui():
    injector = from_scenario(TIMEOUT_STORM)

    assert injector.scenario_id == "timeout_storm"
    assert injector.scenario.label == "The research API hangs"
    assert injector.scenario.node_ids == ["research_1"]


def test_a_malformed_scenario_fails_loudly():
    with pytest.raises(ValidationError):
        from_scenario({"id": "s", "rules": [{"node_id": "n", "kind": "not_a_kind"}]})
    with pytest.raises(ValidationError):
        from_scenario({"id": "s", "rules": [{"node_id": "n", "kind": "timeout", "atempts": [1]}]})


def test_an_injector_can_be_built_from_a_validated_scenario_object():
    scenario = FailureScenario.model_validate(TIMEOUT_STORM)

    assert ScenarioFailureInjector.from_scenario(scenario).scenario is scenario


# ---------------------------------------------------------------- end to end


def _research_workflow() -> object:
    return workflow(
        [
            node("start", BlockType.INPUT),
            node("retry_1", BlockType.RETRY, max_attempts=3),
            node(
                "research_1",
                BlockType.TOOL,
                tool="web_fetch",
                params={"source": "acme-blog"},
                output_field="research",
            ),
            node("end", BlockType.OUTPUT),
        ]
    )


def _executor(scenario: dict | None) -> WorkflowExecutor:
    return WorkflowExecutor(
        model=MockModelProvider(),
        tool=SimulatedToolbox(
            {
                "web_fetch": {
                    "sources": {
                        "acme-blog": {
                            "url": "https://acme.test",
                            "title": "Acme",
                            "content": "quarterly results are up",
                        }
                    }
                }
            }
        ),
        injector=from_scenario(scenario),
    )


async def test_retry_recovers_on_the_attempt_the_scenario_stops_failing():
    """max_attempts=3 with the first two invocations staged to time out."""
    scenario = {
        "id": "timeout_storm",
        "label": "The research API hangs",
        "rules": [{"node_id": "research_1", "kind": "timeout", "first_n": 2}],
    }

    state = await _executor(scenario).start_run(_research_workflow(), {"topic": "acme"})

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["research_1"].status.value == "recovered"
    assert state.snapshots["research_1"].attempts == 3
    assert state.snapshots["retry_1"].output["retried"] is True
    assert state.result["research"]["content"] == "quarterly results are up"


async def test_the_same_scenario_replays_identically():
    scenario = {
        "id": "timeout_storm",
        "rules": [{"node_id": "research_1", "kind": "timeout", "first_n": 2}],
    }

    first = await _executor(scenario).start_run(_research_workflow(), {"topic": "acme"})
    second = await _executor(scenario).start_run(_research_workflow(), {"topic": "acme"})

    assert first.result == second.result
    assert [(event.event, event.node_id, event.status) for event in first.trace] == [
        (event.event, event.node_id, event.status) for event in second.trace
    ]


async def test_exhausting_the_retry_budget_fails_the_run():
    scenario = {
        "id": "timeout_storm",
        "rules": [{"node_id": "research_1", "kind": "timeout", "attempts": "all"}],
    }

    state = await _executor(scenario).start_run(_research_workflow(), {"topic": "acme"})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "timeout"


async def test_the_same_workflow_succeeds_with_failures_switched_off():
    state = await _executor(None).start_run(_research_workflow(), {"topic": "acme"})

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["research_1"].attempts == 1


async def test_a_degrading_rule_spoils_the_output_instead_of_raising():
    """``missing_field`` lets the step run and then drops a field for a validator."""
    nodes = [
        node("start", BlockType.INPUT),
        node("summarise_1", BlockType.AI_MODEL, prompt_id="summarise", output_field="summary"),
        node("end", BlockType.OUTPUT),
    ]
    executor = WorkflowExecutor(
        model=MockModelProvider({"summarise": {"data": {"text": "done", "owner": "Ana"}}}),
        injector=from_scenario(
            {
                "id": "missing_owner",
                "rules": [
                    {
                        "node_id": "summarise_1",
                        "kind": "missing_field",
                        "attempts": "all",
                        "detail": {"field": "summary.owner"},
                    }
                ],
            }
        ),
    )

    state = await executor.start_run(workflow(nodes), {"transcript": "..."})

    assert state.status is RunStatus.COMPLETED
    assert state.result["summary"] == {"text": "done"}


async def test_a_fallback_provider_rescues_a_model_the_scenario_always_breaks():
    """Puzzle 7's shape: primary always fails, the alternate mock provider answers."""
    nodes = [
        node("start", BlockType.INPUT),
        node("retry_1", BlockType.RETRY, max_attempts=2),
        node(
            "fallback_1",
            BlockType.FALLBACK,
            mode="alternate_provider",
            provider="mock-backup",
        ),
        node("draft_1", BlockType.AI_MODEL, prompt_id="draft", output_field="draft"),
        node("end", BlockType.OUTPUT),
    ]
    executor = WorkflowExecutor(
        model=MockModelProvider(
            {"draft": {"data": "primary"}},
            responses_by_provider={"mock-backup": {"draft": {"data": "backup answer"}}},
        ),
        injector=from_scenario(
            {
                "id": "provider_outage",
                "rules": [{"node_id": "draft_1", "kind": "model_error", "first_n": 2}],
            }
        ),
    )

    state = await executor.start_run(workflow(nodes), {"topic": "launch"})

    assert state.status is RunStatus.COMPLETED
    assert state.result["draft"] == "backup answer"
    assert state.snapshots["draft_1"].status.value == "recovered"
    assert state.snapshots["fallback_1"].output["used"] is True
