"""The SSE stream: complete, ordered, and safe to reconnect to.

The stream is the only way the canvas learns what a run did, so the guarantees
tested here are the load-bearing ones:

* every recorded event is replayed from ``seq`` 1 on *every* connection;
* the sequence has no gaps and no duplicates, whoever else is listening;
* exactly one terminator closes the stream, carrying the full ``RunSummary``.

The second point is why the stream never reads the store's live queue: a queue
can only be drained once, so a second listener - or a reconnecting one - would
silently lose whatever the first consumer took.
"""

from __future__ import annotations

import asyncio

import pytest
from api_helpers import (  # noqa: F401 - `api` is a pytest fixture
    api,
    collect_events,
    parse_sse,
    run_to_end,
    start_run,
    summary,
    terminator,
    trace_events,
)

from app.puzzles.registry import get_puzzle

RUN_SUMMARY_KEYS = {
    "run_id",
    "puzzle_id",
    "status",
    "scenario_id",
    "result",
    "error",
    "pending_review",
    "resumed_from",
    "trace",
}


def slow_chain(steps: int = 3, delay_ms: int = 80) -> dict:
    """A workflow that takes long enough to reconnect to while it is running."""
    nodes: list[dict] = [{"id": "start", "type": "input", "label": "Start", "config": {}}]
    edges: list[dict] = []
    previous = "start"
    for index in range(steps):
        node_id = f"fetch_{index}"
        nodes.append(
            {
                "id": node_id,
                "type": "tool",
                "label": f"Fetch {index}",
                "config": {
                    "tool": "web_fetch",
                    "params": {
                        "source": f"source-{index}",
                        "simulate_delay_ms": delay_ms,
                    },
                    "output_field": f"page_{index}",
                },
            }
        )
        edges.append({"id": f"e_{previous}_{node_id}", "source": previous, "target": node_id})
        previous = node_id
    nodes.append({"id": "done", "type": "output", "label": "Done", "config": {}})
    edges.append({"id": f"e_{previous}_done", "source": previous, "target": "done"})
    return {"id": "wf_slow_chain", "name": "Slow chain", "nodes": nodes, "edges": edges}


def sequence(records: list[dict]) -> list[int]:
    return [item["seq"] for item in trace_events(records)]


# ------------------------------------------------------- shape of the stream


async def test_the_stream_is_a_complete_ordered_sequence_ending_in_done(api):
    run_id, records = await run_to_end(
        api,
        get_puzzle("survive-the-research-timeout").starter_workflow.as_dict(),
        puzzle_id="survive-the-research-timeout",
    )

    seqs = sequence(records)
    assert seqs == list(range(1, len(seqs) + 1)), seqs
    assert trace_events(records)[0]["event"] == "run_started"
    assert trace_events(records)[-1]["event"] == "run_completed"

    closing = terminator(records)
    assert closing["event"] == "done"
    assert records[-1] is closing, "the terminator is the last thing on the wire"
    assert set(closing["data"]) == RUN_SUMMARY_KEYS
    assert closing["data"]["run_id"] == run_id
    assert closing["data"]["status"] == "completed"
    # The summary's trace is the same trace that was streamed, event for event.
    assert [item["seq"] for item in closing["data"]["trace"]] == seqs


async def test_every_streamed_event_carries_the_full_trace_event_contract(api):
    _, records = await run_to_end(
        api,
        get_puzzle("survive-the-research-timeout").starter_workflow.as_dict(),
        puzzle_id="survive-the-research-timeout",
    )

    for event in trace_events(records):
        assert set(event) == {
            "seq",
            "run_id",
            "event",
            "timestamp",
            "node_id",
            "node_label",
            "node_type",
            "status",
            "payload",
        }
        assert isinstance(event["payload"], dict)


async def test_a_paused_run_closes_the_stream_with_paused_not_done(api):
    from test_api_runs import approver_canvas

    _, records = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending"
    )

    closing = terminator(records)
    assert closing["event"] == "paused"
    assert set(closing["data"]) == RUN_SUMMARY_KEYS
    assert closing["data"]["status"] == "paused"
    assert closing["data"]["pending_review"]["node_id"] == "approve_reply"
    assert sequence(records) == list(range(1, len(sequence(records)) + 1))


# --------------------------------------------------------------- reconnecting


async def test_reconnecting_after_the_run_replays_byte_for_byte(api):
    run_id, first = await run_to_end(
        api,
        get_puzzle("validate-the-data-extractor").starter_workflow.as_dict(),
        puzzle_id="validate-the-data-extractor",
        scenario_id="garbled-extractor",
    )

    second = await collect_events(api, run_id)

    assert trace_events(second) == trace_events(first)
    assert terminator(second)["data"] == terminator(first)["data"]
    assert sequence(second) == sequence(first)


async def test_reconnecting_mid_run_loses_nothing(api):
    """Drop the connection part-way through, come back, and still see seq 1..N."""
    run_id = await start_run(api, slow_chain())

    partial: list[dict] = []
    async with api.stream("GET", f"/api/runs/{run_id}/events") as response:
        body = ""
        async for chunk in response.aiter_text():
            body += chunk
            partial = parse_sse(body)
            if len(partial) >= 3:
                break

    assert sequence(partial)[:3] == [1, 2, 3]

    records = await collect_events(api, run_id)

    seqs = sequence(records)
    assert seqs == list(range(1, len(seqs) + 1))
    assert seqs[: len(sequence(partial))] == sequence(partial)
    assert terminator(records)["event"] == "done"


async def test_two_listeners_on_one_run_both_see_everything(api):
    """Proof the stream does not consume a shared queue: nobody steals events."""
    run_id = await start_run(api, slow_chain())

    left, right = await asyncio.gather(
        collect_events(api, run_id), collect_events(api, run_id)
    )

    assert trace_events(left) == trace_events(right)
    assert sequence(left) == list(range(1, len(sequence(left)) + 1))
    assert terminator(left)["data"] == terminator(right)["data"]


async def test_a_stream_opened_after_a_review_follows_the_resumed_run(api):
    from test_api_runs import approver_canvas

    run_id, first = await run_to_end(
        api, approver_canvas(), puzzle_id="approve-before-sending"
    )
    paused_at = len(trace_events(first))

    accepted = await api.post(f"/api/runs/{run_id}/review", json={"action": "approve"})
    assert accepted.status_code == 202

    records = await collect_events(api, run_id)

    seqs = sequence(records)
    assert seqs == list(range(1, len(seqs) + 1))
    assert len(seqs) > paused_at, "the resumed steps are streamed too"
    assert terminator(records)["event"] == "done"
    assert terminator(records)["data"]["status"] == "completed"


# ------------------------------------------------------------------ keepalive


async def test_a_quiet_stream_sends_keepalive_comments(
    api, monkeypatch: pytest.MonkeyPatch
):
    """Proxies close silent connections, so a slow run still says something."""
    monkeypatch.setattr("app.api.runs.PING_INTERVAL_S", 0.01)
    run_id = await start_run(api, slow_chain(steps=2, delay_ms=150))

    records = await collect_events(api, run_id)

    assert any(item["comment"] == "ping" for item in records)
    # Comments are not events: the trace sequence is untouched by them.
    seqs = sequence(records)
    assert seqs == list(range(1, len(seqs) + 1))
    assert terminator(records)["event"] == "done"


async def test_streaming_an_unknown_run_is_a_404_before_any_body(api):
    response = await api.get("/api/runs/run_missing/events")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "run_missing" in response.json()["detail"]
