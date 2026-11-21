"""Per-run wiring: which ports a run gets, and what a resume changes.

These are the two decisions the HTTP handlers cannot show on the wire: how a run
is wired to its puzzle's fixtures (so a live Groq key never costs a reviewer the
committed answers) and what "the outage has passed" means for a resumed run.
"""

from __future__ import annotations

import pytest

from app.api.context import RunRegistry, tool_catalogue
from app.failures.injector import NoOpFailureInjector, ScenarioFailureInjector
from app.providers.groq import GroqModelProvider
from app.providers.resilient import ResilientModelProvider
from app.puzzles.registry import get_puzzle
from app.tools.simulator import SimulatedToolbox


@pytest.fixture
def registry() -> RunRegistry:
    return RunRegistry()


def test_a_puzzle_run_gets_that_puzzles_fixtures_on_every_port(registry: RunRegistry):
    puzzle = get_puzzle("survive-the-research-timeout")

    executor, injector = registry.build_executor(puzzle, "slow-archive")

    assert executor.store is registry.store
    assert executor.ports.model.mock.knows("research_brief_v1")
    assert "research-archive" in executor.ports.tool.fixtures["web_fetch"]["sources"]
    assert isinstance(injector, ScenarioFailureInjector)
    assert injector.should_fail("run", "fetch_archive", 1) is not None


def test_a_live_key_keeps_the_puzzles_canned_answers_as_the_safety_net(
    registry: RunRegistry, monkeypatch: pytest.MonkeyPatch
):
    """With GROQ_API_KEY set the run goes live - and still cannot get stuck."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)
    puzzle = get_puzzle("validate-the-data-extractor")

    executor, _ = registry.build_executor(puzzle, None)

    model = executor.ports.model
    assert isinstance(model, ResilientModelProvider)
    assert isinstance(model.primary, GroqModelProvider)
    assert model.mock.knows("contact_extraction_v1")


def test_without_a_key_the_model_port_is_the_mock_itself(
    registry: RunRegistry, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    puzzle = get_puzzle("validate-the-data-extractor")

    executor, _ = registry.build_executor(puzzle, None)

    assert executor.ports.model.primary is None
    assert executor.ports.model.mock.knows("contact_extraction_v1")


def test_a_run_without_a_puzzle_gets_plain_ports_and_stages_nothing(
    registry: RunRegistry,
):
    executor, injector = registry.build_executor(None, "slow-archive")

    assert isinstance(injector, NoOpFailureInjector)
    assert executor.ports.tool.fixtures == {}
    assert executor.ports.retrieval.fixtures == {}


def test_a_selected_scenario_that_does_not_exist_stages_nothing(registry: RunRegistry):
    puzzle = get_puzzle("survive-the-research-timeout")

    _, injector = registry.build_executor(puzzle, "not-a-scenario")

    assert injector.should_fail("run", "fetch_archive", 1) is None


def test_the_resumed_executor_shares_the_store_but_stages_no_failures(
    registry: RunRegistry,
):
    """Resuming means the outage has passed: same fixtures, nothing set to fail."""
    from app.api.context import RunContext

    puzzle = get_puzzle("resume-the-interrupted-mission")
    executor, injector = registry.build_executor(puzzle, "mission-interrupted")
    context = RunContext(
        run_id="run_source",
        executor=executor,
        puzzle=puzzle,
        scenario_id="mission-interrupted",
        scenario_enabled=True,
        injector=injector,
    )

    resumed = registry.resumed_executor(context)

    assert resumed.store is registry.store
    assert resumed.ports.injector.should_fail("run", "dispatch", 1) is None
    # ...but the fixtures the reused steps produced are still there.
    assert resumed.ports.model.mock.knows("mission_plan_v1")
    assert resumed.ports.retrieval.sources == ["mission_archive"]


def test_the_tool_catalogue_describes_every_tool_the_toolbox_offers():
    catalogue = tool_catalogue()

    assert [item["name"] for item in catalogue] == SimulatedToolbox().tool_names
    assert all(item["description"].endswith(".") for item in catalogue)
