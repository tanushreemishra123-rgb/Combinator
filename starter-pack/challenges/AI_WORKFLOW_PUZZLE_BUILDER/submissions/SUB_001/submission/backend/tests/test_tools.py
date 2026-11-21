"""Simulated toolbox and fixture retrieval: determinism, failures and delays."""

from __future__ import annotations

import time

import pytest

from app.engine.errors import ToolFailure
from app.engine.executor import WorkflowExecutor
from app.engine.model import BlockType
from app.engine.run import RunStatus
from app.tools.retrieval import FixtureRetrieval
from app.tools.simulator import SimulatedToolbox
from tests.conftest import node, workflow

FIXTURES = {
    "knowledge_search": {
        "documents": {
            "refund policy": [
                {"id": "kb-1", "title": "Refunds", "snippet": "14 day window."}
            ]
        },
        "default": [{"id": "kb-0", "title": "Getting started", "snippet": "..."}],
    },
    "ticket_lookup": {
        "tickets": {
            "TCK-4821": {"subject": "Card declined", "priority": "high", "product_area": "billing"}
        }
    },
    "web_fetch": {
        "sources": {
            "acme-blog": {"url": "https://acme.test/blog", "title": "Acme blog", "content": "one two three"},
            "rival-blog": {"url": "https://rival.test/blog", "title": "Rival blog", "content": "four five"},
        }
    },
}


@pytest.fixture
def toolbox() -> SimulatedToolbox:
    return SimulatedToolbox(FIXTURES)


# ------------------------------------------------------------------- dispatching


async def test_unknown_tool_raises_tool_failure(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure) as caught:
        await toolbox.call("send_carrier_pigeon", {}, None)

    assert caught.value.detail["tool"] == "send_carrier_pigeon"
    assert "knowledge_search" in caught.value.detail["available"]


def test_tool_names_are_the_five_simulated_tools(toolbox: SimulatedToolbox):
    assert toolbox.tool_names == [
        "calculator",
        "knowledge_search",
        "send_message",
        "ticket_lookup",
        "web_fetch",
    ]


async def test_simulate_error_lets_a_puzzle_stage_a_tool_outage(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure) as caught:
        await toolbox.call("web_fetch", {"source": "acme-blog", "simulate_error": "503"}, None)

    assert caught.value.detail["simulated"] is True


# ------------------------------------------------------------------------- tools


async def test_knowledge_search_returns_committed_documents(toolbox: SimulatedToolbox):
    documents = await toolbox.call("knowledge_search", {"query": "Refund Policy"}, None)

    assert [doc["id"] for doc in documents] == ["kb-1"]


async def test_knowledge_search_reads_the_query_from_the_data(toolbox: SimulatedToolbox):
    documents = await toolbox.call(
        "knowledge_search", {"query_field": "question"}, {"question": "refund policy"}
    )

    assert [doc["id"] for doc in documents] == ["kb-1"]


async def test_knowledge_search_without_a_query_returns_nothing(toolbox: SimulatedToolbox):
    assert await toolbox.call("knowledge_search", {}, {}) == []


async def test_knowledge_search_falls_back_to_the_committed_default(toolbox: SimulatedToolbox):
    documents = await toolbox.call("knowledge_search", {"query": "anything else"}, None)

    assert [doc["id"] for doc in documents] == ["kb-0"]


async def test_knowledge_search_synthesises_stable_documents_without_fixtures():
    bare = SimulatedToolbox()

    first = await bare.call("knowledge_search", {"query": "sso setup"}, None)
    second = await bare.call("knowledge_search", {"query": "SSO   setup"}, None)

    assert first == second
    assert len(first) == 2
    assert first != await bare.call("knowledge_search", {"query": "billing"}, None)


async def test_knowledge_search_honours_top_k(toolbox: SimulatedToolbox):
    documents = await SimulatedToolbox().call(
        "knowledge_search", {"query": "sso setup", "top_k": 1}, None
    )

    assert len(documents) == 1


async def test_ticket_lookup_returns_committed_metadata(toolbox: SimulatedToolbox):
    ticket = await toolbox.call("ticket_lookup", {"ticket_id": "TCK-4821"}, None)

    assert ticket == {
        "ticket_id": "TCK-4821",
        "subject": "Card declined",
        "priority": "high",
        "product_area": "billing",
    }


async def test_ticket_lookup_synthesises_unknown_tickets_deterministically(toolbox: SimulatedToolbox):
    first = await toolbox.call("ticket_lookup", {"ticket_id_field": "id"}, {"id": "TCK-9"})
    second = await toolbox.call("ticket_lookup", {"ticket_id": "TCK-9"}, None)

    assert first == second
    assert first["priority"] in {"low", "normal", "high", "urgent"}


async def test_ticket_lookup_without_an_id_fails(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure):
        await toolbox.call("ticket_lookup", {}, {})


async def test_send_message_reports_what_would_have_been_sent(toolbox: SimulatedToolbox):
    sent = await toolbox.call(
        "send_message",
        {"channel": "#support", "message_field": "reply", "to": "customer"},
        {"reply": "Your refund is on the way."},
    )

    assert sent["sent"] is True
    assert sent["channel"] == "#support"
    assert sent["preview"] == "Your refund is on the way."
    assert sent["characters"] == 26


async def test_send_message_is_deterministic(toolbox: SimulatedToolbox):
    payload = {"reply": "hello"}
    first = await toolbox.call("send_message", {"message_field": "reply"}, payload)
    second = await toolbox.call("send_message", {"message_field": "reply"}, payload)

    assert first == second


async def test_web_fetch_returns_different_content_per_source(toolbox: SimulatedToolbox):
    acme = await toolbox.call("web_fetch", {"source": "acme-blog"}, None)
    rival = await toolbox.call("web_fetch", {"source": "rival-blog"}, None)

    assert acme["content"] != rival["content"]
    assert acme["url"] == "https://acme.test/blog"
    assert acme["words"] == 3


async def test_web_fetch_synthesises_unknown_sources_stably(toolbox: SimulatedToolbox):
    first = await toolbox.call("web_fetch", {"source": "unknown-source"}, None)
    second = await toolbox.call("web_fetch", {"source": "unknown-source"}, None)

    assert first == second
    assert "unknown-source" in first["url"]


async def test_web_fetch_without_a_source_fails(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure):
        await toolbox.call("web_fetch", {}, {})


@pytest.mark.parametrize(
    ("op", "expected"),
    [("sum", 10.0), ("mean", 2.5), ("min", 1.0), ("max", 4.0), ("count", 4.0)],
)
async def test_calculator_aggregates(toolbox: SimulatedToolbox, op: str, expected: float):
    result = await toolbox.call(
        "calculator", {"op": op, "field": "order.amounts"}, {"order": {"amounts": [1, 2, 3, 4]}}
    )

    assert result["value"] == expected
    assert result["op"] == op


async def test_calculator_does_binary_arithmetic(toolbox: SimulatedToolbox):
    result = await toolbox.call(
        "calculator", {"op": "multiply", "field": "total", "value": 1.2}, {"total": 10}
    )

    assert result["value"] == 12.0


async def test_calculator_rejects_unsupported_operations(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure) as caught:
        await toolbox.call("calculator", {"op": "exec", "field": "total"}, {"total": 1})

    assert "sum" in caught.value.detail["supported"]


async def test_calculator_rejects_non_numeric_data(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure):
        await toolbox.call("calculator", {"op": "sum", "field": "total"}, {"total": "ten"})


async def test_calculator_rejects_a_missing_field(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure):
        await toolbox.call("calculator", {"op": "sum", "field": "nope"}, {"total": 1})


async def test_calculator_refuses_division_by_zero(toolbox: SimulatedToolbox):
    with pytest.raises(ToolFailure):
        await toolbox.call(
            "calculator", {"op": "divide", "field": "total", "value": 0}, {"total": 1}
        )


# ------------------------------------------------------------------------ delays


async def test_simulate_delay_ms_actually_sleeps(toolbox: SimulatedToolbox):
    started = time.perf_counter()
    await toolbox.call("web_fetch", {"source": "acme-blog", "simulate_delay_ms": 60}, None)

    assert time.perf_counter() - started >= 0.05


async def test_a_slow_tool_trips_a_timeout_guard_through_the_real_executor():
    """A ``simulate_delay_ms`` alone - no injector - makes the Timeout guard fire."""
    nodes = [
        node("start", BlockType.INPUT),
        node("timeout_1", BlockType.TIMEOUT, timeout_ms=20),
        node(
            "fetch_1",
            BlockType.TOOL,
            tool="web_fetch",
            params={"source": "acme-blog", "simulate_delay_ms": 200},
            output_field="research",
        ),
        node("end", BlockType.OUTPUT),
    ]
    executor = WorkflowExecutor(tool=SimulatedToolbox(FIXTURES))

    state = await executor.start_run(workflow(nodes), {"topic": "acme"})

    assert state.status is RunStatus.FAILED
    assert state.error["kind"] == "timeout"
    assert state.snapshots["fetch_1"].status.value == "failed"


# --------------------------------------------------------------------- retrieval


RETRIEVAL_FIXTURES = {
    "default_source": "support_handbook",
    "sources": {
        "support_handbook": {
            "documents": {
                "refund policy": [
                    {"id": "d1", "title": "Refunds", "content": "14 days.", "score": 0.9},
                    {"id": "d2", "title": "Exceptions", "content": "Gift cards.", "score": 0.6},
                ]
            }
        },
        "engineering_wiki": {
            "documents": {"*": [{"id": "w1", "title": "Runbook", "content": "Restart it."}]}
        },
    },
}


@pytest.fixture
def retrieval() -> FixtureRetrieval:
    return FixtureRetrieval(RETRIEVAL_FIXTURES)


async def test_retrieval_returns_committed_documents(retrieval: FixtureRetrieval):
    documents = await retrieval.retrieve({"query": "Refund policy"}, None)

    assert [doc["id"] for doc in documents] == ["d1", "d2"]


async def test_retrieval_honours_top_k(retrieval: FixtureRetrieval):
    documents = await retrieval.retrieve({"query": "refund policy", "top_k": 1}, None)

    assert [doc["id"] for doc in documents] == ["d1"]


async def test_retrieval_reads_the_query_out_of_the_data(retrieval: FixtureRetrieval):
    documents = await retrieval.retrieve(
        {"query_field": "question"}, {"question": "refund policy"}
    )

    assert len(documents) == 2


async def test_an_empty_query_retrieves_nothing(retrieval: FixtureRetrieval):
    assert await retrieval.retrieve({}, {}) == []
    assert await retrieval.retrieve({"query": "   "}, None) == []


async def test_an_unanswerable_question_retrieves_nothing(retrieval: FixtureRetrieval):
    assert await retrieval.retrieve({"query": "who wins the world cup"}, None) == []


async def test_a_source_catch_all_answers_every_query(retrieval: FixtureRetrieval):
    documents = await retrieval.retrieve(
        {"query": "anything", "source": "engineering_wiki"}, None
    )

    assert [doc["id"] for doc in documents] == ["w1"]


async def test_an_unknown_source_retrieves_nothing(retrieval: FixtureRetrieval):
    assert await retrieval.retrieve({"query": "refund policy", "source": "nope"}, None) == []


async def test_retrieval_accepts_a_flat_single_source_fixture():
    flat = FixtureRetrieval({"documents": {"*": [{"id": "only"}]}})

    assert await flat.retrieve({"query": "anything"}, None) == [{"id": "only"}]


async def test_retrieval_is_deterministic_and_copies_documents(retrieval: FixtureRetrieval):
    first = await retrieval.retrieve({"query": "refund policy"}, None)
    first[0]["title"] = "mutated"
    second = await retrieval.retrieve({"query": "refund policy"}, None)

    assert second[0]["title"] == "Refunds"


async def test_empty_retrieval_flows_through_the_real_retrieval_block():
    """An unanswerable question ends with document_count 0 - no injector involved."""
    nodes = [
        node("start", BlockType.INPUT),
        node(
            "retrieve_1",
            BlockType.RETRIEVAL,
            query_field="question",
            source="support_handbook",
            output_field="documents",
            count_field="document_count",
        ),
        node("end", BlockType.OUTPUT),
    ]
    executor = WorkflowExecutor(retrieval=FixtureRetrieval(RETRIEVAL_FIXTURES))

    state = await executor.start_run(
        workflow(nodes), {"question": "who wins the world cup"}
    )

    assert state.status is RunStatus.COMPLETED
    assert state.result["documents"] == []
    assert state.result["document_count"] == 0
