"""Shared engine-test helpers: graph builders and in-memory fakes of every port."""

from __future__ import annotations

import asyncio
from collections.abc import Iterable, Sequence
from typing import Any

import pytest

from app.engine.errors import ModelFailure
from app.engine.model import BlockType, EdgeDef, NodeDef, WorkflowDef
from app.engine.ports import FailurePlan, ModelResult
from app.engine.run import RunState
from app.engine.trace import EventType, TraceEvent

# ------------------------------------------------------------ environment guard


@pytest.fixture(autouse=True)
def _isolated_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run every test in mock mode unless it says otherwise.

    A developer (or CI) with a real ``GROQ_API_KEY``/``GEMINI_API_KEY`` exported
    would otherwise flip the app into live mode mid-suite. Tests that want a key
    set it themselves, after this has cleared the slate.
    """
    from app.providers.factory import ENV_KEYS

    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


# --------------------------------------------------------------- graph builders


def node(node_id: str, block_type: BlockType, label: str | None = None, **config: Any) -> NodeDef:
    """Build a :class:`NodeDef`; keyword arguments become the block config."""
    return NodeDef(
        id=node_id,
        type=block_type,
        label=label or node_id.replace("_", " ").title(),
        config=config,
    )


def edge(source: str, target: str, handle: str | None = None) -> EdgeDef:
    suffix = f"_{handle}" if handle else ""
    return EdgeDef(id=f"e_{source}_{target}{suffix}", source=source, target=target, source_handle=handle)


def chain(nodes: Sequence[NodeDef]) -> list[EdgeDef]:
    return [edge(nodes[i].id, nodes[i + 1].id) for i in range(len(nodes) - 1)]


def workflow(
    nodes: Sequence[NodeDef],
    edges: Iterable[EdgeDef] | None = None,
    *,
    workflow_id: str = "wf_test",
    name: str = "Test workflow",
) -> WorkflowDef:
    """Build a workflow; without explicit edges the nodes are chained in order."""
    return WorkflowDef(
        id=workflow_id,
        name=name,
        nodes=list(nodes),
        edges=list(edges) if edges is not None else chain(nodes),
    )


# ------------------------------------------------------------------- port fakes


class FakeModelPort:
    """A deterministic model provider.

    ``response`` may be a value or a callable of the incoming data. ``responses``
    supplies one value per call (the last repeats). ``provider_responses`` keys
    answers by requested provider, which is how alternate-provider fallback is
    exercised.
    """

    def __init__(
        self,
        response: Any = None,
        *,
        responses: Sequence[Any] | None = None,
        provider_responses: dict[str | None, Any] | None = None,
        confidence: float | None = 0.9,
        provider: str = "mock",
        delay: float = 0.0,
    ) -> None:
        self.response = response
        self.responses = list(responses) if responses else None
        self.provider_responses = provider_responses
        self.confidence = confidence
        self.provider = provider
        self.delay = delay
        self.calls: list[tuple[dict[str, Any], Any, str | None]] = []

    @property
    def call_count(self) -> int:
        return len(self.calls)

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult:
        self.calls.append((prompt_config, data, provider))
        if self.delay:
            await asyncio.sleep(self.delay)

        if self.provider_responses is not None:
            if provider not in self.provider_responses:
                raise ModelFailure(f"provider {provider!r} is unavailable")
            answer = self.provider_responses[provider]
        elif self.responses is not None:
            index = min(len(self.calls) - 1, len(self.responses) - 1)
            answer = self.responses[index]
        else:
            answer = self.response

        if isinstance(answer, Exception):
            raise answer
        if callable(answer):
            answer = answer(data)
        return ModelResult(
            data=answer,
            confidence=self.confidence,
            raw=repr(answer),
            provider_used=provider or self.provider,
            mocked=True,
        )


class FakeToolPort:
    """Returns a canned value (or raises) for every tool call."""

    def __init__(self, result: Any = None, *, error: Exception | None = None, delay: float = 0.0) -> None:
        self.result = result
        self.error = error
        self.delay = delay
        self.calls: list[tuple[str, dict[str, Any], Any]] = []

    @property
    def call_count(self) -> int:
        return len(self.calls)

    async def call(self, tool_name: str, config: dict[str, Any], data: Any) -> Any:
        self.calls.append((tool_name, config, data))
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error is not None:
            raise self.error
        if callable(self.result):
            return self.result(data)
        return self.result


class FakeRetrievalPort:
    """Returns a canned document list."""

    def __init__(self, documents: list[dict[str, Any]] | None = None, *, error: Exception | None = None) -> None:
        self.documents = documents if documents is not None else []
        self.error = error
        self.calls: list[tuple[dict[str, Any], Any]] = []

    async def retrieve(self, query_config: dict[str, Any], data: Any) -> list[dict[str, Any]]:
        self.calls.append((query_config, data))
        if self.error is not None:
            raise self.error
        return list(self.documents)


class ScriptedInjector:
    """Deterministic failure injection keyed by ``(node_id, attempt)``.

    ``enabled`` lets a test stage a failure for the first run and then execute a
    clean resume, which is exactly how the "resume the interrupted mission"
    puzzle behaves.
    """

    def __init__(self, plans: dict[tuple[str, int], FailurePlan] | None = None) -> None:
        self.plans = dict(plans or {})
        self.enabled = True
        self.consulted: list[tuple[str, str, int]] = []

    def stage(self, node_id: str, attempt: int, plan: FailurePlan) -> ScriptedInjector:
        self.plans[(node_id, attempt)] = plan
        return self

    def should_fail(self, run_id: str, node_id: str, attempt: int) -> FailurePlan | None:
        self.consulted.append((run_id, node_id, attempt))
        if not self.enabled:
            return None
        return self.plans.get((node_id, attempt))


# ------------------------------------------------------------- trace utilities


def events_of(state: RunState, event: EventType, node_id: str | None = None) -> list[TraceEvent]:
    """Every trace event of a kind, optionally narrowed to one node."""
    return [
        item
        for item in state.trace
        if item.event is event and (node_id is None or item.node_id == node_id)
    ]


def statuses_from_trace(state: RunState) -> dict[str, str]:
    """Rebuild each node's final status using only the trace."""
    terminal = {
        EventType.STEP_COMPLETED,
        EventType.STEP_FAILED,
        EventType.STEP_RECOVERED,
        EventType.STEP_SKIPPED,
        EventType.REVIEW_REQUESTED,
    }
    statuses: dict[str, str] = {}
    for item in state.trace:
        if item.event in terminal and item.node_id and item.status is not None:
            statuses[item.node_id] = item.status.value
    return statuses


def io_from_trace(state: RunState) -> dict[str, dict[str, Any]]:
    """Rebuild each node's final input/output using only the trace."""
    carrying = {
        EventType.STEP_COMPLETED,
        EventType.STEP_FAILED,
        EventType.STEP_RECOVERED,
        EventType.STEP_SKIPPED,
        EventType.REVIEW_REQUESTED,
    }
    recovered: dict[str, dict[str, Any]] = {}
    for item in state.trace:
        if item.event in carrying and item.node_id and "input" in item.payload:
            recovered[item.node_id] = {
                "input": item.payload.get("input"),
                "output": item.payload.get("output"),
            }
    return recovered
