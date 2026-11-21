"""The catalogue and pre-flight endpoints, checked against the frozen contract."""

from __future__ import annotations

import pytest
from api_helpers import api  # noqa: F401 - pytest fixture

from app.puzzles.registry import all_puzzles, get_puzzle

PUZZLE_IDS = [
    "fix-the-meeting-summarizer",
    "approve-before-sending",
    "ground-the-knowledge-assistant",
    "repair-the-ticket-router",
    "survive-the-research-timeout",
    "validate-the-data-extractor",
    "activate-the-fallback",
    "resume-the-interrupted-mission",
]

SUMMARY_KEYS = {"id", "title", "difficulty", "tagline", "concepts", "order"}
DETAIL_KEYS = SUMMARY_KEYS | {
    "objective",
    "description",
    "sample_input",
    "expected_output",
    "available_blocks",
    "starter_workflow",
    "solution_hint",
    "failure_scenarios",
    "completion_criteria",
}


# ============================================================ GET /api/puzzles


async def test_puzzle_list_returns_all_eight_cards_in_play_order(api):
    response = await api.get("/api/puzzles")

    assert response.status_code == 200
    cards = response.json()
    assert [card["id"] for card in cards] == PUZZLE_IDS
    assert [card["order"] for card in cards] == list(range(1, 9))
    assert all(set(card) == SUMMARY_KEYS for card in cards)


# ======================================================= GET /api/puzzles/{id}


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
async def test_puzzle_detail_carries_everything_the_builder_needs(api, puzzle_id: str):
    detail = (await api.get(f"/api/puzzles/{puzzle_id}")).json()

    assert set(detail) >= DETAIL_KEYS
    assert detail["id"] == puzzle_id
    assert detail["completion_criteria"]
    assert detail["starter_workflow"]["nodes"]
    # Canvas positions survive the round trip, and edges keep React Flow's alias.
    assert all(node["position"] for node in detail["starter_workflow"]["nodes"])
    assert all("sourceHandle" in edge for edge in detail["starter_workflow"]["edges"])


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_detail_never_leaks_the_injector_rules(puzzle_id: str):
    """The failure scenarios are the puzzle's answer key; only the blurb ships."""
    detail = get_puzzle(puzzle_id).detail()

    for scenario in detail.failure_scenarios:
        assert set(scenario.model_dump()) == {"id", "label", "description"}


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
async def test_tools_are_offered_exactly_when_a_tool_block_is(api, puzzle_id: str):
    detail = (await api.get(f"/api/puzzles/{puzzle_id}")).json()

    if "tool" in detail["available_blocks"]:
        assert detail["tools"], "a Tool block needs tools to choose from"
        assert all({"name", "description"} == set(item) for item in detail["tools"])
        assert all(item["description"].strip() for item in detail["tools"])
    else:
        assert "tools" not in detail, "no Tool block, so no tool select"


async def test_tool_puzzles_offer_the_tools_their_starter_already_calls(api):
    """The dropdown must contain the tool the committed starter workflow uses."""
    for puzzle in all_puzzles():
        if "tool" not in [item.value for item in puzzle.available_blocks]:
            continue
        detail = (await api.get(f"/api/puzzles/{puzzle.id}")).json()
        offered = {item["name"] for item in detail["tools"]}
        used = {
            node.config["tool"]
            for node in puzzle.starter_workflow.nodes
            if node.type.value == "tool" and node.config.get("tool")
        }
        assert used <= offered, f"{puzzle.id}: {used - offered} missing from the select"


async def test_unknown_puzzle_is_a_404_with_a_detail_message(api):
    response = await api.get("/api/puzzles/not-a-puzzle")

    assert response.status_code == 404
    assert "not-a-puzzle" in response.json()["detail"]


# ============================================= POST /api/workflows/validate


async def test_validate_accepts_a_healthy_starter_workflow(api):
    puzzle = get_puzzle("survive-the-research-timeout")

    response = await api.post(
        "/api/workflows/validate",
        json={"workflow": puzzle.starter_workflow.as_dict()},
    )

    assert response.status_code == 200
    assert response.json() == {"valid": True, "errors": [], "warnings": []}


async def test_validate_reports_every_problem_with_a_broken_graph(api):
    broken = {
        "id": "wf_broken",
        "name": "Broken",
        "nodes": [
            {"id": "in", "type": "input", "label": "In", "config": {}},
            {"id": "ai", "type": "ai_model", "label": "AI", "config": {"prompt": "hi"}},
            {"id": "ghost", "type": "output", "label": "Ghost", "config": {}},
        ],
        "edges": [
            {"id": "e_in_ai", "source": "in", "target": "ai"},
            {"id": "e_nowhere", "source": "ai", "target": "missing"},
        ],
    }

    body = (await api.post("/api/workflows/validate", json={"workflow": broken})).json()

    assert body["valid"] is False
    codes = {issue["code"] for issue in body["errors"]}
    assert "unknown_edge_endpoint" in codes
    assert "disconnected_node" in codes
    # Every issue is exactly the contract shape - no engine-internal extras.
    for issue in body["errors"] + body["warnings"]:
        assert set(issue) == {"code", "message", "node_id", "edge_id"}
        assert issue["message"]
    dangling = [item for item in body["errors"] if item["code"] == "unknown_edge_endpoint"]
    assert dangling[0]["edge_id"] == "e_nowhere"


async def test_validate_warns_but_does_not_reject_an_unwired_safe_stop(api):
    """A Safe Stop is reached by a human rejection, not by an edge - a warning."""
    puzzle = get_puzzle("approve-before-sending")

    body = (
        await api.post(
            "/api/workflows/validate",
            json={"workflow": puzzle.starter_workflow.as_dict()},
        )
    ).json()

    assert body["valid"] is True
    assert [issue["code"] for issue in body["warnings"]] == ["disconnected_node"]
    assert body["warnings"][0]["node_id"] == "stop_send"
