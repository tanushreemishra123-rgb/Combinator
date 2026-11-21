"""Full puzzle journeys driven entirely through the HTTP API.

Each test plays a puzzle the way a browser would: POST the canvas, follow the
SSE stream, answer a review, ask for a resume, read the reliability report. No
test touches the executor, the store or the registry, so a pass means the
*contract* carries the whole experience.
"""

from __future__ import annotations

from api_helpers import (  # noqa: F401 - `api` is a pytest fixture
    api,
    collect_events,
    event_names,
    events_for,
    reliability,
    run_to_end,
    start_run,
    summary,
    terminator,
    trace_events,
    trace_kinds,
)
from puzzle_helpers import block, canvas, insert_before

from app.puzzles.registry import get_puzzle

# ------------------------------------------------------------ repaired canvases


def research_canvas() -> dict:
    """Puzzle 5, repaired: a Retry in front of the archive's Timeout."""
    puzzle = get_puzzle("survive-the-research-timeout")
    return insert_before(
        canvas(puzzle),
        "archive_timeout",
        block(
            "archive_retry",
            "retry",
            "Try the archive 3 times",
            (420, 200),
            max_attempts=3,
        ),
    )


def approver_canvas() -> dict:
    """Puzzle 2, repaired: a Human Review between the draft and the send."""
    puzzle = get_puzzle("approve-before-sending")
    return insert_before(
        canvas(puzzle),
        "send_reply",
        block(
            "approve_reply",
            "human_review",
            "Approve before sending",
            (580, 200),
            prompt="This reply is about to go to the customer.",
            allowed_actions=["approve", "edit", "reject"],
        ),
    )


def extractor_canvas() -> dict:
    """Puzzle 6, repaired: a Retry guarding the extractor itself."""
    puzzle = get_puzzle("validate-the-data-extractor")
    return insert_before(
        canvas(puzzle),
        "extract",
        block(
            "extract_retry",
            "retry",
            "Try the extractor twice",
            (190, 200),
            max_attempts=2,
        ),
    )


# ================================ (a) puzzle 5: retry survives the slow archive


async def test_research_run_streams_a_retry_and_a_recovery_to_a_clean_finish(api):
    run_id, records = await run_to_end(
        api,
        research_canvas(),
        puzzle_id="survive-the-research-timeout",
        scenario_id="slow-archive",
    )

    closing = terminator(records)
    assert closing["event"] == "done"
    assert closing["data"]["status"] == "completed"
    assert closing["data"]["run_id"] == run_id
    assert closing["data"]["puzzle_id"] == "survive-the-research-timeout"
    assert closing["data"]["scenario_id"] == "slow-archive"

    trace = trace_events(records)
    archive = events_for(trace, "fetch_archive")
    kinds = [item["event"] for item in archive]
    assert kinds.count("step_retrying") == 2, kinds
    assert "step_recovered" in kinds
    # The retry comes first, the recovery afterwards - that is the whole story.
    assert kinds.index("step_retrying") < kinds.index("step_recovered")
    recovered = next(item for item in archive if item["event"] == "step_recovered")
    assert recovered["status"] == "recovered"
    assert recovered["payload"]["attempt"] == 3

    body = await summary(api, run_id)
    assert body["result"]["sources"] == ["acme-status-blog", "research-archive"]
    assert body["error"] is None

    report = await reliability(api, run_id)
    assert report["injected_failure_handled"] is True
    assert report["retries_used"] == 2
    assert report["puzzle_solved"] is True
    assert report["grade"] == "resilient"
    assert report["run_id"] == run_id


async def test_research_starter_without_the_retry_dies_on_the_timeout(api):
    puzzle = get_puzzle("survive-the-research-timeout")

    run_id, records = await run_to_end(
        api,
        puzzle.starter_workflow.as_dict(),
        puzzle_id=puzzle.id,
        scenario_id="slow-archive",
    )

    assert terminator(records)["data"]["status"] == "failed"
    body = await summary(api, run_id)
    assert body["error"]["kind"] == "timeout"
    assert trace_kinds(trace_events(records))[-1] == "run_failed"

    report = await reliability(api, run_id)
    assert report["grade"] == "broken"
    assert report["injected_failure_handled"] is False
    assert report["puzzle_solved"] is False


# ==================================== (b) puzzle 2: the human decides, both ways


async def test_approved_draft_pauses_for_a_person_then_ships(api):
    run_id, first = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending", scenario_id="spicy-model"
    )

    paused = terminator(first)
    assert paused["event"] == "paused"
    assert paused["data"]["status"] == "paused"
    review = paused["data"]["pending_review"]
    assert review["node_id"] == "approve_reply"
    assert review["allowed_actions"] == ["approve", "edit", "reject"]
    assert review["data"]["draft"]["tone"] == "apologetic"
    assert set(review) == {
        "node_id",
        "node_label",
        "prompt",
        "data",
        "allowed_actions",
        "validation",
    }

    accepted = await api.post(
        f"/api/runs/{run_id}/review", json={"action": "approve", "note": "Ship it"}
    )
    assert accepted.status_code == 202
    assert accepted.json() == {"run_id": run_id}

    second = await collect_events(api, run_id)
    assert terminator(second)["event"] == "done"

    body = await summary(api, run_id)
    assert body["status"] == "completed"
    assert body["pending_review"] is None
    assert body["result"]["delivery"]["sent"] is True
    assert body["result"]["delivery"]["to"] == "maya.chen@example.test"

    decisions = [item for item in body["trace"] if item["event"] == "review_decision"]
    assert decisions[0]["payload"]["action"] == "approve"
    assert decisions[0]["payload"]["note"] == "Ship it"

    report = await reliability(api, run_id)
    assert report["human_review_used"] is True
    assert report["puzzle_solved"] is True
    assert report["grade"] == "resilient"


async def test_rejected_draft_stops_safely_and_sends_nothing(api):
    run_id, first = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending", scenario_id="spicy-model"
    )
    assert terminator(first)["event"] == "paused"

    accepted = await api.post(
        f"/api/runs/{run_id}/review",
        json={"action": "reject", "note": "The refund promise is not ours to make."},
    )
    assert accepted.status_code == 202

    closing = terminator(await collect_events(api, run_id))
    assert closing["event"] == "done"
    assert closing["data"]["status"] == "safely_stopped"

    body = await summary(api, run_id)
    assert body["status"] == "safely_stopped"
    assert "delivery" not in (body["result"] or {})
    stopped = [item for item in body["trace"] if item["event"] == "run_safe_stopped"]
    assert "refund promise" in stopped[0]["payload"]["explanation"]

    report = await reliability(api, run_id)
    assert report["safe_stop_used"] is True
    assert report["human_review_used"] is True
    assert report["puzzle_solved"] is True


async def test_an_edited_draft_carries_the_reviewers_correction_through(api):
    run_id, _ = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending", scenario_id="spicy-model"
    )
    paused = await summary(api, run_id)
    edited = dict(paused["pending_review"]["data"])
    edited["draft"] = {**edited["draft"], "body": "Hi Maya, the duplicate charge is refunded."}

    accepted = await api.post(
        f"/api/runs/{run_id}/review", json={"action": "edit", "edited_data": edited}
    )
    assert accepted.status_code == 202
    await collect_events(api, run_id)

    body = await summary(api, run_id)
    assert body["status"] == "completed"
    assert body["result"]["draft"]["body"].endswith("is refunded.")
    assert body["result"]["delivery"]["preview"].endswith("is refunded.")


# ============================ (c) puzzle 8: resume the run the outage killed


async def test_interrupted_mission_resumes_into_a_brand_new_finished_run(api):
    failed_id, first = await run_to_end(
        api,
        get_puzzle("resume-the-interrupted-mission").starter_workflow.as_dict(),
        puzzle_id="resume-the-interrupted-mission",
        scenario_id="mission-interrupted",
    )
    assert terminator(first)["data"]["status"] == "failed"
    assert (await summary(api, failed_id))["error"]["kind"] == "tool_error"

    accepted = await api.post(f"/api/runs/{failed_id}/resume-last")
    assert accepted.status_code == 202
    resumed_id = accepted.json()["run_id"]
    assert resumed_id != failed_id

    records = await collect_events(api, resumed_id)
    closing = terminator(records)
    assert closing["event"] == "done"
    assert closing["data"]["status"] == "completed"
    assert closing["data"]["resumed_from"] == failed_id
    assert closing["data"]["puzzle_id"] == "resume-the-interrupted-mission"

    trace = trace_events(records)
    assert trace_kinds(trace).count("step_skipped") == 4
    reused = {item["node_id"] for item in trace if item["event"] == "step_skipped"}
    assert {"mission_brief", "plan_mission", "check_plan"} <= reused

    body = await summary(api, resumed_id)
    assert body["result"]["dispatch"]["sent"] is True
    assert body["result"]["mission_status"] == "dispatched"

    report = await reliability(api, resumed_id)
    assert report["run_id"] == resumed_id
    assert report["injected_failure_handled"] is True
    assert report["puzzle_solved"] is True
    assert report["grade"] == "recovered"
    assert any("Resumed from the last successful step" in item for item in report["strengths"])

    # The first run is untouched and still tells its own story.
    assert (await summary(api, failed_id))["status"] == "failed"


def slow_workflow(delay_ms: int = 400) -> dict:
    """A workflow whose one tool call really does take a while."""
    return {
        "id": "wf_slow",
        "name": "Slow",
        "nodes": [
            {"id": "start", "type": "input", "label": "Start", "config": {}},
            {
                "id": "slow_call",
                "type": "tool",
                "label": "Slow tool",
                "config": {
                    "tool": "web_fetch",
                    "params": {"source": "somewhere", "simulate_delay_ms": delay_ms},
                    "output_field": "page",
                },
            },
            {"id": "done", "type": "output", "label": "Done", "config": {}},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "slow_call"},
            {"id": "e2", "source": "slow_call", "target": "done"},
        ],
    }


async def test_a_run_still_in_flight_cannot_be_resumed_or_reviewed(api):
    """A run that has not stopped yet has no 'last successful step' to resume from."""
    run_id = await start_run(api, slow_workflow())

    in_flight = await summary(api, run_id)
    assert in_flight["status"] == "running"

    resume = await api.post(f"/api/runs/{run_id}/resume-last")
    assert resume.status_code == 409
    assert "still running" in resume.json()["detail"]

    review = await api.post(f"/api/runs/{run_id}/review", json={"action": "approve"})
    assert review.status_code == 409
    assert "running" in review.json()["detail"]

    score = await api.get(f"/api/runs/{run_id}/reliability")
    assert score.status_code == 409

    # ...and it still finishes normally once it is left alone.
    assert terminator(await collect_events(api, run_id))["data"]["status"] == "completed"


# ================= (d) puzzle 6: a retry turns unparseable JSON into a record


async def test_extractor_recovers_from_broken_json_and_solves_the_puzzle(api):
    run_id, records = await run_to_end(
        api,
        extractor_canvas(),
        puzzle_id="validate-the-data-extractor",
        scenario_id="garbled-extractor",
    )

    assert terminator(records)["data"]["status"] == "completed"
    trace = trace_events(records)
    extract = events_for(trace, "extract")
    assert "step_retrying" in [item["event"] for item in extract]
    recovered = [item for item in extract if item["event"] == "step_recovered"]
    assert recovered and recovered[0]["status"] == "recovered"

    validations = [item for item in trace if item["event"] == "validation_result"]
    assert validations[-1]["payload"]["passed"] is True

    body = await summary(api, run_id)
    assert body["result"]["invoice_number"] == "NW-2291"
    assert body["result"]["currency"] == "EUR"

    report = await reliability(api, run_id)
    assert report["output_valid"] is True
    assert report["injected_failure_handled"] is True
    assert report["puzzle_solved"] is True
    assert [item["met"] for item in report["completion"]] == [True] * 5


async def test_extractor_starter_never_reaches_the_validator(api):
    puzzle = get_puzzle("validate-the-data-extractor")

    run_id, records = await run_to_end(
        api,
        puzzle.starter_workflow.as_dict(),
        puzzle_id=puzzle.id,
        scenario_id="garbled-extractor",
    )

    assert terminator(records)["data"]["status"] == "failed"
    assert "validation_result" not in trace_kinds(trace_events(records))
    report = await reliability(api, run_id)
    assert report["unhandled_errors"] == ["invalid_output"]
    assert report["grade"] == "broken"


# ================================================= runs without a puzzle


async def test_a_run_without_a_puzzle_uses_the_body_input_and_scores_untethered(api):
    workflow = {
        "id": "wf_plain",
        "name": "Plain",
        "nodes": [
            {"id": "start", "type": "input", "label": "Start", "config": {}},
            {
                "id": "tag",
                "type": "transform",
                "label": "Tag it",
                "config": {"operation": "merge", "values": {"tagged": True}},
            },
            {"id": "done", "type": "output", "label": "Done", "config": {}},
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "tag"},
            {"id": "e2", "source": "tag", "target": "done"},
        ],
    }

    run_id, records = await run_to_end(api, workflow, input={"hello": "world"})

    assert terminator(records)["data"]["status"] == "completed"
    body = await summary(api, run_id)
    assert body["puzzle_id"] is None
    assert body["scenario_id"] is None
    assert body["result"] == {"hello": "world", "tagged": True}

    report = await reliability(api, run_id)
    assert report["puzzle_id"] is None
    assert report["injected_failure_handled"] is None
    assert report["completion"] == []


async def test_the_input_defaults_to_the_puzzles_sample_input(api):
    puzzle = get_puzzle("resume-the-interrupted-mission")

    run_id, _ = await run_to_end(
        api, puzzle.starter_workflow.as_dict(), puzzle_id=puzzle.id
    )

    body = await summary(api, run_id)
    started = next(item for item in body["trace"] if item["event"] == "run_started")
    assert started["payload"]["input"] == puzzle.sample_input
    assert body["result"]["mission_status"] == "dispatched"


async def test_a_run_never_mutates_the_seeded_sample_input(api):
    """Two runs of the same puzzle must see identical input."""
    puzzle = get_puzzle("resume-the-interrupted-mission")
    before = dict(puzzle.sample_input)

    for _ in range(2):
        await run_to_end(api, puzzle.starter_workflow.as_dict(), puzzle_id=puzzle.id)

    assert get_puzzle(puzzle.id).sample_input == before


# ====================================================== errors and edge cases


async def test_unknown_run_ids_are_404_everywhere(api):
    for path in ("", "/events", "/reliability"):
        response = await api.get(f"/api/runs/run_nope{path}")
        assert response.status_code == 404, path
        assert "run_nope" in response.json()["detail"]

    for path in ("/review", "/resume-last"):
        response = await api.post(f"/api/runs/run_nope{path}", json={"action": "approve"})
        assert response.status_code == 404, path


async def test_reviewing_a_run_that_is_not_paused_is_a_409(api):
    run_id, _ = await run_to_end(
        api, research_canvas(), puzzle_id="survive-the-research-timeout"
    )

    response = await api.post(f"/api/runs/{run_id}/review", json={"action": "approve"})

    assert response.status_code == 409
    assert "not waiting for a review" in response.json()["detail"]


async def test_a_decision_the_review_does_not_allow_is_a_409(api):
    workflow = approver_canvas()
    for node in workflow["nodes"]:
        if node["id"] == "approve_reply":
            node["config"]["allowed_actions"] = ["approve", "reject"]

    run_id, _ = await run_to_end(
        api, workflow, puzzle_id="approve-before-sending", scenario_id="spicy-model"
    )

    response = await api.post(
        f"/api/runs/{run_id}/review", json={"action": "edit", "edited_data": {}}
    )

    assert response.status_code == 409
    assert "does not allow 'edit'" in response.json()["detail"]
    assert (await summary(api, run_id))["status"] == "paused"


async def test_reliability_is_refused_while_a_run_is_paused(api):
    run_id, _ = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending", scenario_id="spicy-model"
    )

    response = await api.get(f"/api/runs/{run_id}/reliability")

    assert response.status_code == 409
    assert "paused" in response.json()["detail"]


async def test_an_unrunnable_workflow_ends_as_run_failed_not_as_a_hang(api):
    """A graph the engine refuses must still finish the run and close the stream."""
    broken = {
        "id": "wf_broken",
        "name": "Broken",
        "nodes": [{"id": "in", "type": "input", "label": "In", "config": {}}],
        "edges": [],
    }

    run_id, records = await run_to_end(api, broken)

    closing = terminator(records)
    assert closing["event"] == "done"
    assert closing["data"]["status"] == "failed"
    assert trace_kinds(trace_events(records)) == ["run_failed"]
    body = await summary(api, run_id)
    assert body["error"]["kind"] == "workflow_invalid"
    assert body["error"]["detail"]["errors"]


async def test_starting_a_run_for_an_unknown_puzzle_is_a_404(api):
    puzzle = get_puzzle("survive-the-research-timeout")

    response = await api.post(
        "/api/runs",
        json={"workflow": puzzle.starter_workflow.as_dict(), "puzzle_id": "nope"},
    )

    assert response.status_code == 404
    assert "nope" in response.json()["detail"]


async def test_an_unknown_scenario_id_simply_stages_nothing(api):
    """The failure toggle must never be able to break a run by naming a typo."""
    run_id, records = await run_to_end(
        api,
        get_puzzle("survive-the-research-timeout").starter_workflow.as_dict(),
        puzzle_id="survive-the-research-timeout",
        scenario_id="not-a-scenario",
    )

    assert terminator(records)["data"]["status"] == "completed"
    body = await summary(api, run_id)
    assert body["scenario_id"] is None
    report = await reliability(api, run_id)
    assert report["injected_failure_handled"] is None


async def test_the_run_id_comes_back_before_the_workflow_has_finished(api):
    """``POST /runs`` is an acceptance, not a result: 202 with an id, no trace."""
    run_id = await start_run(
        api,
        research_canvas(),
        puzzle_id="survive-the-research-timeout",
        scenario_id="slow-archive",
    )

    assert run_id.startswith("run_")
    # The stream is opened afterwards and still replays from the very first event.
    records = await collect_events(api, run_id)
    assert trace_events(records)[0]["seq"] == 1
    assert trace_events(records)[0]["event"] == "run_started"


async def test_every_journey_reports_the_same_run_id_everywhere(api):
    run_id, records = await run_to_end(
        api, research_canvas(), puzzle_id="survive-the-research-timeout"
    )

    assert {item["run_id"] for item in trace_events(records)} == {run_id}
    assert (await summary(api, run_id))["run_id"] == run_id
    assert (await reliability(api, run_id))["run_id"] == run_id
    assert event_names(records)[-1] == "done"
