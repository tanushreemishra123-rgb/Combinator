"""Structured graph validation - the errors behind the builder's "check workflow"."""

from __future__ import annotations

import pytest
from conftest import FakeModelPort, edge, node, workflow

from app.engine.errors import WorkflowValidationError
from app.engine.executor import WorkflowExecutor
from app.engine.graph import validate_workflow
from app.engine.model import BlockType


def codes(graph) -> list[str]:
    return validate_workflow(graph).error_codes


def test_a_valid_linear_workflow_reports_no_errors():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
        ]
    )

    report = validate_workflow(graph)

    assert report.valid is True
    assert report.errors == []


def test_a_cycle_is_detected():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("a", BlockType.TRANSFORM, operation="merge"),
            node("b", BlockType.TRANSFORM, operation="merge"),
            node("output", BlockType.OUTPUT),
        ],
        edges=[
            edge("input", "a"),
            edge("a", "b"),
            edge("b", "a"),
            edge("b", "output"),
        ],
    )

    report = validate_workflow(graph)

    assert "cycle_detected" in report.error_codes
    cycle = next(issue for issue in report.errors if issue.code == "cycle_detected")
    assert set(cycle.detail["nodes"]) == {"a", "b"}


def test_a_missing_input_block_is_an_error():
    graph = workflow([node("ai", BlockType.AI_MODEL), node("output", BlockType.OUTPUT)])

    assert "missing_input_node" in codes(graph)


def test_two_input_blocks_are_an_error():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("input2", BlockType.INPUT),
            node("output", BlockType.OUTPUT),
        ],
        edges=[edge("input", "output"), edge("input2", "output")],
    )

    assert "multiple_input_nodes" in codes(graph)


def test_a_disconnected_node_is_an_error():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("output", BlockType.OUTPUT),
            node("orphan", BlockType.AI_MODEL),
            node("orphan_out", BlockType.OUTPUT),
        ],
        edges=[edge("input", "output"), edge("orphan", "orphan_out")],
    )

    report = validate_workflow(graph)

    assert "disconnected_node" in report.error_codes
    assert {issue.node_id for issue in report.errors if issue.code == "disconnected_node"} == {
        "orphan",
        "orphan_out",
    }


def test_an_unreachable_safe_stop_is_only_a_warning():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("output", BlockType.OUTPUT),
            node("stop", BlockType.SAFE_STOP),
        ],
        edges=[edge("input", "output")],
    )

    report = validate_workflow(graph)

    assert report.valid is True
    assert [issue.code for issue in report.warnings] == ["disconnected_node"]


def test_a_workflow_without_a_terminal_block_is_an_error():
    graph = workflow(
        [node("input", BlockType.INPUT), node("ai", BlockType.AI_MODEL)],
        edges=[edge("input", "ai")],
    )

    assert "missing_terminal_node" in codes(graph)


def test_a_condition_needs_both_branches():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("check", BlockType.CONDITION, field="x", operator="exists"),
            node("output", BlockType.OUTPUT),
        ],
        edges=[edge("input", "check"), edge("check", "output", "true")],
    )

    report = validate_workflow(graph)

    assert "missing_condition_branch" in report.error_codes
    issue = next(i for i in report.errors if i.code == "missing_condition_branch")
    assert issue.detail["handle"] == "false"


def test_only_a_condition_may_branch():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
            node("output2", BlockType.OUTPUT),
        ],
        edges=[
            edge("input", "ai"),
            edge("ai", "output"),
            edge("ai", "output2"),
        ],
    )

    assert "ambiguous_branch" in codes(graph)


def test_a_guard_must_protect_a_block():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("ai", BlockType.AI_MODEL),
            node("retry", BlockType.RETRY, max_attempts=2),
            node("output", BlockType.OUTPUT),
        ]
    )

    assert "guard_protects_terminal" in codes(graph)


def test_a_guard_with_nothing_after_it_is_an_error():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("output", BlockType.OUTPUT),
            node("retry", BlockType.RETRY, max_attempts=2),
        ],
        edges=[edge("input", "output")],
    )

    report = validate_workflow(graph)

    assert "dangling_guard" in report.error_codes


def test_an_unknown_edge_endpoint_is_an_error():
    graph = workflow(
        [node("input", BlockType.INPUT), node("output", BlockType.OUTPUT)],
        edges=[edge("input", "output"), edge("output", "ghost")],
    )

    assert "unknown_edge_endpoint" in codes(graph)


def test_an_invalid_block_config_is_reported_against_its_node():
    graph = workflow(
        [
            node("input", BlockType.INPUT),
            node("retry", BlockType.RETRY, max_attempts=0),
            node("ai", BlockType.AI_MODEL),
            node("output", BlockType.OUTPUT),
        ]
    )

    report = validate_workflow(graph)

    assert "invalid_config" in report.error_codes
    issue = next(i for i in report.errors if i.code == "invalid_config")
    assert issue.node_id == "retry"


async def test_starting_an_invalid_workflow_raises_with_the_full_report():
    executor = WorkflowExecutor(model=FakeModelPort("x"))
    graph = workflow([node("ai", BlockType.AI_MODEL), node("output", BlockType.OUTPUT)])

    with pytest.raises(WorkflowValidationError) as exc_info:
        await executor.start_run(graph, {})

    assert "missing_input_node" in exc_info.value.report.error_codes
