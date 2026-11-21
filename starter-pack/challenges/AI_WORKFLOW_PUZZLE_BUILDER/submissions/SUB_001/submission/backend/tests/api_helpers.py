"""Helpers for driving the HTTP API the way the frontend will.

Every API test talks to the real ASGI app over ``httpx.ASGITransport`` - no
executor, store or registry is reached into directly, so a passing test is
evidence the *contract* works, not just the engine underneath it.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
import pytest

from app.api.context import RunRegistry
from app.main import app

_BLANK_LINE = re.compile(r"\r?\n\r?\n")


@pytest.fixture
async def api():
    """An async client bound to the app, with a fresh run registry each test."""
    app.state.runs = RunRegistry()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver", timeout=30.0
    ) as client:
        yield client


# ---------------------------------------------------------------------- SSE


def parse_sse(raw: str) -> list[dict[str, Any]]:
    """Decode an SSE body into ``{event, data, id, comment}`` records."""
    records: list[dict[str, Any]] = []
    for block in _BLANK_LINE.split(raw.strip("\r\n")):
        if not block.strip():
            continue
        record: dict[str, Any] = {"event": None, "data": None, "id": None, "comment": None}
        payload: list[str] = []
        for line in block.splitlines():
            if line.startswith(":"):
                record["comment"] = line[1:].strip()
            elif line.startswith("event:"):
                record["event"] = line[len("event:") :].strip()
            elif line.startswith("data:"):
                payload.append(line[len("data:") :].lstrip())
            elif line.startswith("id:"):
                record["id"] = line[len("id:") :].strip()
        if payload:
            record["data"] = json.loads("\n".join(payload))
        records.append(record)
    return records


async def collect_events(client: httpx.AsyncClient, run_id: str) -> list[dict[str, Any]]:
    """Open the SSE stream for ``run_id`` and read it until the server closes it."""
    body = ""
    async with client.stream("GET", f"/api/runs/{run_id}/events") as response:
        assert response.status_code == 200, response
        assert response.headers["content-type"].startswith("text/event-stream")
        async for chunk in response.aiter_text():
            body += chunk
    return parse_sse(body)


def trace_events(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [item["data"] for item in records if item["event"] == "trace"]


def terminator(records: list[dict[str, Any]]) -> dict[str, Any]:
    """The single closing ``paused``/``done`` record of a stream."""
    closing = [item for item in records if item["event"] in {"paused", "done"}]
    assert len(closing) == 1, [item["event"] for item in records]
    return closing[0]


# ------------------------------------------------------------------- running


async def start_run(
    client: httpx.AsyncClient,
    workflow: dict[str, Any],
    *,
    puzzle_id: str | None = None,
    scenario_id: str | None = None,
    **extra: Any,
) -> str:
    """``POST /api/runs`` and return the accepted run id."""
    body: dict[str, Any] = {"workflow": workflow, **extra}
    if puzzle_id is not None:
        body["puzzle_id"] = puzzle_id
    if scenario_id is not None:
        body["scenario_id"] = scenario_id
    response = await client.post("/api/runs", json=body)
    assert response.status_code == 202, response.text
    return response.json()["run_id"]


async def run_to_end(
    client: httpx.AsyncClient,
    workflow: dict[str, Any],
    *,
    puzzle_id: str | None = None,
    scenario_id: str | None = None,
    **extra: Any,
) -> tuple[str, list[dict[str, Any]]]:
    """Start a run and stream it until the server closes the stream."""
    run_id = await start_run(
        client, workflow, puzzle_id=puzzle_id, scenario_id=scenario_id, **extra
    )
    return run_id, await collect_events(client, run_id)


async def summary(client: httpx.AsyncClient, run_id: str) -> dict[str, Any]:
    response = await client.get(f"/api/runs/{run_id}")
    assert response.status_code == 200, response.text
    return response.json()


async def reliability(client: httpx.AsyncClient, run_id: str) -> dict[str, Any]:
    response = await client.get(f"/api/runs/{run_id}/reliability")
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------- assertions


def event_names(records: list[dict[str, Any]]) -> list[str]:
    return [item["event"] for item in records if item["event"]]


def trace_kinds(trace: list[dict[str, Any]]) -> list[str]:
    return [item["event"] for item in trace]


def events_for(trace: list[dict[str, Any]], node_id: str) -> list[dict[str, Any]]:
    return [item for item in trace if item["node_id"] == node_id]
