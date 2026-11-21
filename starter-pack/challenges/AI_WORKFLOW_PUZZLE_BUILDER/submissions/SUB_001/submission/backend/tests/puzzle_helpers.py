"""Helpers for playing a seeded puzzle end to end, exactly as a user would.

The repairs in the puzzle tests are expressed as *canvas edits* - splice a block
into a chain, change one config field - rather than hand-written workflows, so a
passing test is real evidence that the fix a player is told to make actually
works.
"""

from __future__ import annotations

import copy
from typing import Any

from app.engine.executor import WorkflowExecutor
from app.engine.model import WorkflowDef
from app.engine.run import RunState
from app.failures.injector import from_scenario, off
from app.puzzles.models import Puzzle
from app.puzzles.registry import puzzle_ports

# ------------------------------------------------------------- canvas editing


def canvas(puzzle: Puzzle) -> dict[str, Any]:
    """The starter workflow as canvas JSON, ready to be edited."""
    return puzzle.starter_workflow.as_dict()


def block(
    node_id: str, block_type: str, label: str, position: tuple[int, int] = (0, 0), **config: Any
) -> dict[str, Any]:
    """A new canvas block, the way the palette would drop one."""
    return {
        "id": node_id,
        "type": block_type,
        "label": label,
        "config": config,
        "position": {"x": position[0], "y": position[1]},
    }


def insert_before(workflow: dict[str, Any], target_id: str, node: dict[str, Any]) -> dict[str, Any]:
    """Splice ``node`` into the chain immediately before ``target_id``."""
    edited = copy.deepcopy(workflow)
    edited["nodes"].append(copy.deepcopy(node))
    rewired = [edge for edge in edited["edges"] if edge["target"] == target_id]
    if not rewired:
        raise AssertionError(f"nothing connects to {target_id!r}")
    for edge in rewired:
        edge["target"] = node["id"]
    edited["edges"].append(
        {
            "id": f"e_{node['id']}_{target_id}",
            "source": node["id"],
            "target": target_id,
            "sourceHandle": None,
        }
    )
    return edited


def set_config(workflow: dict[str, Any], node_id: str, **updates: Any) -> dict[str, Any]:
    """Change one block's config, the way the config panel would."""
    edited = copy.deepcopy(workflow)
    for node in edited["nodes"]:
        if node["id"] == node_id:
            node["config"] = {**(node.get("config") or {}), **updates}
            return edited
    raise AssertionError(f"no block called {node_id!r}")


def as_workflow(workflow: dict[str, Any] | WorkflowDef) -> WorkflowDef:
    if isinstance(workflow, WorkflowDef):
        return workflow
    return WorkflowDef.model_validate(workflow)


# ------------------------------------------------------------------- running


def executor_for(
    puzzle: Puzzle, scenario_id: str | None = None, *, enabled: bool = True
) -> WorkflowExecutor:
    """An executor wired to this puzzle's committed fixtures."""
    fixtures = puzzle_ports(puzzle)
    scenario = puzzle.scenario(scenario_id) if enabled else None
    return WorkflowExecutor(
        model=fixtures.model_provider(),
        tool=fixtures.toolbox(),
        retrieval=fixtures.retrieval(),
        injector=from_scenario(scenario) if scenario else off(),
    )


def resumed_executor(puzzle: Puzzle, source: WorkflowExecutor) -> WorkflowExecutor:
    """An executor over the same run store with the injector switched off.

    This is what "the outage has passed" means for a resume: same runs, same
    fixtures, nothing staged to fail.
    """
    fixtures = puzzle_ports(puzzle)
    return WorkflowExecutor(
        store=source.store,
        model=fixtures.model_provider(),
        tool=fixtures.toolbox(),
        retrieval=fixtures.retrieval(),
        injector=off(),
    )


async def play(
    puzzle: Puzzle,
    workflow: dict[str, Any] | WorkflowDef | None = None,
    scenario_id: str | None = None,
    *,
    sample_input: Any = None,
) -> tuple[WorkflowExecutor, RunState]:
    """Run ``workflow`` (default: the starter) once and return the executor + run."""
    executor = executor_for(puzzle, scenario_id)
    graph = as_workflow(workflow) if workflow is not None else puzzle.workflow()
    data = copy.deepcopy(puzzle.sample_input if sample_input is None else sample_input)
    state = await executor.start_run(graph, data, scenario_id=scenario_id)
    return executor, state


# ---------------------------------------------------------------- assertions


def failed_at(state: RunState) -> str | None:
    """The node id the run failed on, read back out of the trace."""
    from app.engine.trace import EventType

    for event in reversed(state.trace):
        if event.event is EventType.RUN_FAILED:
            return event.payload.get("failed_node_id")
    return None


def error_kind(state: RunState) -> str | None:
    return (state.error or {}).get("kind")


def event_types(state: RunState) -> list[str]:
    return [event.event.value for event in state.trace]


def trace_fingerprint(state: RunState) -> list[dict[str, Any]]:
    """The whole trace minus the two things that legitimately differ per run.

    Two runs of the same workflow, input and scenario must produce identical
    fingerprints; two runs that differ only in whether the scenario was staged
    must not.
    """
    return [
        event.model_dump(mode="json", exclude={"timestamp", "run_id"})
        for event in state.trace
    ]
