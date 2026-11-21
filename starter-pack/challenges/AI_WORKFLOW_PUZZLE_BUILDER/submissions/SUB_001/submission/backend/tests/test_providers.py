"""Provider layer: deterministic mock, Groq and OpenAI-compatible (Gemini)
message/parse/error mapping, provider selection, auto-fallback.

No test here touches the network: the Groq provider is always driven through a
fake async client, and the OpenAI-compatible provider through a fake
``httpx.AsyncClient``.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import groq
import httpx
import pytest

from app.engine.errors import InvalidOutputError, ModelFailure, StepTimeout
from app.providers._prompting import REPAIR_INSTRUCTION
from app.providers.factory import (
    ProviderSettings,
    build_model_port,
    provider_status,
)
from app.providers.groq import DEFAULT_MODEL, GroqModelProvider
from app.providers.mock import MockModelProvider, prompt_id_for
from app.providers.openai_compat import (
    GEMINI_BASE_URL,
    GEMINI_DEFAULT_MODEL,
    OpenAICompatProvider,
)
from app.providers.resilient import ResilientModelProvider

SUMMARY_PROMPT = {"prompt_id": "summarise_meeting", "task": "summarise the meeting"}


# ------------------------------------------------------------------ mock provider


async def test_mock_returns_the_canned_response():
    provider = MockModelProvider(
        {"summarise_meeting": {"data": {"summary": "we shipped"}, "confidence": 0.81}}
    )

    result = await provider.call(SUMMARY_PROMPT, {"transcript": "..."})

    assert result.data == {"summary": "we shipped"}
    assert result.confidence == 0.81
    assert result.mocked is True
    assert result.provider_used == "mock"


async def test_mock_accepts_a_bare_value_as_the_response_data():
    provider = MockModelProvider({"summarise_meeting": "a plain string answer"})

    result = await provider.call(SUMMARY_PROMPT, None)

    assert result.data == "a plain string answer"
    assert result.confidence == pytest.approx(0.92)


async def test_mock_is_deterministic_for_the_same_input():
    provider = MockModelProvider({"summarise_meeting": {"data": {"summary": "x"}}})

    first = await provider.call(SUMMARY_PROMPT, {"transcript": "a"})
    second = await provider.call(SUMMARY_PROMPT, {"transcript": "a"})

    assert first.model_dump() == second.model_dump()


async def test_unknown_prompt_is_synthesised_stably_across_instances_and_data():
    first = await MockModelProvider().call(SUMMARY_PROMPT, {"transcript": "a"})
    second = await MockModelProvider().call(SUMMARY_PROMPT, {"transcript": "COMPLETELY OTHER"})

    assert first.model_dump() == second.model_dump()
    assert first.data["prompt_id"] == "summarise_meeting"
    assert first.data["task"] == "summarise the meeting"
    assert first.mocked is True


async def test_different_prompts_synthesise_different_answers():
    provider = MockModelProvider()

    one = await provider.call({"prompt_id": "alpha", "task": "a"}, None)
    two = await provider.call({"prompt_id": "beta", "task": "b"}, None)

    assert one.data["fingerprint"] != two.data["fingerprint"]


async def test_alternate_provider_returns_a_different_canned_answer():
    provider = MockModelProvider(
        {"route_ticket": {"data": {"category": None}, "confidence": 0.3}},
        responses_by_provider={
            "mock-backup": {
                "route_ticket": {"data": {"category": "billing"}, "confidence": 0.88}
            }
        },
    )

    primary = await provider.call({"prompt_id": "route_ticket"}, None)
    backup = await provider.call({"prompt_id": "route_ticket"}, None, "mock-backup")

    assert primary.data == {"category": None}
    assert backup.data == {"category": "billing"}
    assert backup.provider_used == "mock:mock-backup"


async def test_alternate_provider_falls_through_to_the_shared_table():
    provider = MockModelProvider(
        {"route_ticket": {"data": {"category": "billing"}}},
        responses_by_provider={"mock-backup": {"other_prompt": {"data": 1}}},
    )

    backup = await provider.call({"prompt_id": "route_ticket"}, None, "mock-backup")

    assert backup.data == {"category": "billing"}


async def test_unknown_prompt_synthesis_differs_per_alternate_provider():
    provider = MockModelProvider()

    primary = await provider.call({"prompt_id": "p"}, None)
    backup = await provider.call({"prompt_id": "p"}, None, "mock-backup")

    assert primary.data["fingerprint"] != backup.data["fingerprint"]


def test_prompt_id_falls_back_to_a_stable_digest_of_the_prompt():
    config = {"instruction": "summarise", "system": "be terse"}

    first = prompt_id_for(config)
    second = prompt_id_for(dict(reversed(list(config.items()))))

    assert first == second
    assert first.startswith("auto:")
    assert prompt_id_for({"instruction": "something else"}) != first


def test_mock_knows_which_prompts_are_committed():
    provider = MockModelProvider({"a": 1}, responses_by_provider={"mock-backup": {"b": 2}})

    assert provider.knows("a") is True
    assert provider.knows("b") is False
    assert provider.knows("b", "mock-backup") is True


# ------------------------------------------------------------------ groq provider


class FakeCompletions:
    """Stands in for ``client.chat.completions``; records the request it was given."""

    def __init__(self, content: str = "{}", error: Exception | None = None, delay: float = 0.0):
        self.content = content
        self.error = error
        self.delay = delay
        self.requests: list[dict[str, Any]] = []

    async def create(self, **request: Any) -> Any:
        self.requests.append(request)
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.error is not None:
            raise self.error
        return {"choices": [{"message": {"content": self.content}}]}


class FakeGroqClient:
    def __init__(self, completions: FakeCompletions) -> None:
        self.chat = type("Chat", (), {"completions": completions})()


def groq_provider(**kwargs: Any) -> tuple[GroqModelProvider, FakeCompletions]:
    completions = FakeCompletions(**kwargs)
    return GroqModelProvider(client=FakeGroqClient(completions)), completions


def test_build_messages_includes_system_instruction_format_and_data():
    provider, _ = groq_provider()

    messages = provider.build_messages(
        {
            "system": "You route tickets.",
            "instruction": "Pick a category.",
            "output_format": {"category": "string"},
        },
        {"ticket": "TCK-1"},
    )

    assert [message["role"] for message in messages] == ["system", "user"]
    assert messages[0]["content"].startswith("You route tickets.")
    assert "single valid JSON object" in messages[0]["content"]
    assert "Pick a category." in messages[1]["content"]
    assert '"category": "string"' in messages[1]["content"]
    assert '"ticket": "TCK-1"' in messages[1]["content"]


def test_build_messages_without_a_json_expectation_stays_plain():
    provider, _ = groq_provider()

    messages = provider.build_messages({"instruction": "Say hi."}, {"a": 1})

    assert "single valid JSON object" not in messages[0]["content"]


async def test_json_response_is_parsed_and_confidence_extracted():
    provider, completions = groq_provider(
        content='{"category": "billing", "confidence": 0.77}'
    )

    result = await provider.call(
        {"instruction": "route", "expects_json": True}, {"ticket": 1}
    )

    assert result.data == {"category": "billing", "confidence": 0.77}
    assert result.confidence == 0.77
    assert result.mocked is False
    assert result.provider_used == f"groq:{DEFAULT_MODEL}"
    assert completions.requests[0]["response_format"] == {"type": "json_object"}


async def test_a_fenced_json_answer_is_still_parsed():
    provider, _ = groq_provider(content='```json\n{"ok": true}\n```')

    result = await provider.call({"expects_json": True}, None)

    assert result.data == {"ok": True}


async def test_plain_text_answers_are_returned_verbatim():
    provider, completions = groq_provider(content="just some prose")

    result = await provider.call({"instruction": "chat"}, None)

    assert result.data == "just some prose"
    assert result.confidence is None
    assert "response_format" not in completions.requests[0]


async def test_malformed_json_raises_invalid_output_with_the_raw_text():
    provider, _ = groq_provider(content="{not json at all")

    with pytest.raises(InvalidOutputError) as caught:
        await provider.call({"expects_json": True}, None)

    assert caught.value.detail["raw"] == "{not json at all"
    assert caught.value.kind == "invalid_output"


async def test_api_errors_map_to_model_failure():
    error = groq.AuthenticationError(
        "bad key",
        response=_fake_response(401),
        body=None,
    )
    provider, _ = groq_provider(error=error)

    with pytest.raises(ModelFailure) as caught:
        await provider.call({"instruction": "x"}, None)

    assert caught.value.detail["error_type"] == "AuthenticationError"


async def test_connection_errors_map_to_model_failure():
    provider, _ = groq_provider(error=groq.APIConnectionError(request=_fake_request()))

    with pytest.raises(ModelFailure):
        await provider.call({"instruction": "x"}, None)


async def test_groq_timeout_errors_map_to_step_timeout():
    provider, _ = groq_provider(error=groq.APITimeoutError(request=_fake_request()))

    with pytest.raises(StepTimeout):
        await provider.call({"instruction": "x"}, None)


async def test_a_slow_call_raises_step_timeout():
    completions = FakeCompletions(delay=0.2)
    provider = GroqModelProvider(client=FakeGroqClient(completions), timeout_s=0.01)

    with pytest.raises(StepTimeout) as caught:
        await provider.call({"instruction": "x"}, None)

    assert caught.value.detail["timeout_s"] == 0.01


async def test_an_empty_choice_list_is_a_model_failure():
    provider = GroqModelProvider(client=_client_returning({"choices": []}))

    with pytest.raises(ModelFailure):
        await provider.call({"instruction": "x"}, None)


async def test_the_model_can_be_overridden_per_block():
    provider, completions = groq_provider(content="hi")

    result = await provider.call({"model": "llama-3.1-8b-instant"}, None)

    assert completions.requests[0]["model"] == "llama-3.1-8b-instant"
    assert result.provider_used == "groq:llama-3.1-8b-instant"


def _fake_response(status: int) -> Any:
    import httpx

    return httpx.Response(status, request=_fake_request())


def _fake_request() -> Any:
    import httpx

    return httpx.Request("POST", "https://api.groq.test/openai/v1/chat/completions")


def _client_returning(payload: dict[str, Any]) -> Any:
    class Completions:
        async def create(self, **_: Any) -> Any:
            return payload

    return FakeGroqClient(Completions())  # type: ignore[arg-type]


# ------------------------------------------------------ openai-compatible (gemini)


class FakeHttpx:
    """A stand-in for ``httpx.AsyncClient`` that records every POST it is given.

    Nothing here opens a socket: the scripted answer is returned as a real
    ``httpx.Response`` so status handling and ``.json()`` behave exactly as they
    would against the live endpoint.
    """

    def __init__(
        self,
        content: str = "{}",
        *,
        status: int = 200,
        error: Exception | None = None,
        delay: float = 0.0,
    ) -> None:
        self.content = content
        self.status = status
        self.error = error
        self.delay = delay
        self.client_kwargs: list[dict[str, Any]] = []
        self.posts: list[dict[str, Any]] = []
        self.closed = 0

    def install(self, monkeypatch: pytest.MonkeyPatch) -> FakeHttpx:
        monkeypatch.setattr(httpx, "AsyncClient", self._client_class())
        return self

    def _client_class(self) -> Any:
        script = self

        class Client:
            def __init__(self, **kwargs: Any) -> None:
                script.client_kwargs.append(kwargs)

            async def __aenter__(self) -> Client:
                return self

            async def __aexit__(self, *_: Any) -> bool:
                script.closed += 1
                return False

            async def post(self, url: str, json: Any = None) -> httpx.Response:
                script.posts.append({"url": url, "json": json})
                if script.delay:
                    await asyncio.sleep(script.delay)
                if script.error is not None:
                    raise script.error
                request = httpx.Request("POST", f"https://provider.test/{url}")
                return httpx.Response(
                    script.status,
                    json={"choices": [{"message": {"content": script.content}}]},
                    request=request,
                )

        return Client


def gemini(**kwargs: Any) -> OpenAICompatProvider:
    return OpenAICompatProvider(
        api_key="key-123",
        base_url=GEMINI_BASE_URL,
        model=GEMINI_DEFAULT_MODEL,
        provider_name="gemini",
        **kwargs,
    )


def test_openai_compat_builds_exactly_the_groq_messages():
    """Prompt shaping is shared, so a block cannot mean two things."""
    config = {
        "system": "You route tickets.",
        "instruction": "Pick a category.",
        "output_format": {"category": "string"},
    }
    groq_side, _ = groq_provider()

    assert gemini().build_messages(config, {"ticket": 1}) == groq_side.build_messages(
        config, {"ticket": 1}
    )
    assert gemini().wants_json(config) is groq_side.wants_json(config) is True
    assert gemini().wants_json({"instruction": "hi"}) is False


async def test_gemini_json_response_is_parsed_and_confidence_extracted(
    monkeypatch: pytest.MonkeyPatch,
):
    script = FakeHttpx('{"category": "billing", "confidence": 0.77}').install(monkeypatch)

    result = await gemini().call({"instruction": "route", "expects_json": True}, {"t": 1})

    assert result.data == {"category": "billing", "confidence": 0.77}
    assert result.confidence == 0.77
    assert result.mocked is False
    assert result.provider_used == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert script.posts[0]["url"] == "chat/completions"
    assert script.posts[0]["json"]["response_format"] == {"type": "json_object"}
    assert script.posts[0]["json"]["model"] == GEMINI_DEFAULT_MODEL
    assert script.client_kwargs[0]["base_url"] == GEMINI_BASE_URL
    assert script.client_kwargs[0]["headers"]["Authorization"] == "Bearer key-123"
    assert script.closed == 1  # the scoped client is always closed again


async def test_a_fenced_gemini_answer_is_still_parsed(monkeypatch: pytest.MonkeyPatch):
    FakeHttpx('```json\n{"ok": true}\n```').install(monkeypatch)

    result = await gemini().call({"expects_json": True}, None)

    assert result.data == {"ok": True}


async def test_gemini_plain_text_answers_are_returned_verbatim(
    monkeypatch: pytest.MonkeyPatch,
):
    script = FakeHttpx("just some prose").install(monkeypatch)

    result = await gemini().call({"instruction": "chat"}, None)

    assert result.data == "just some prose"
    assert result.confidence is None
    assert "response_format" not in script.posts[0]["json"]


async def test_gemini_malformed_json_raises_invalid_output_with_the_raw_text(
    monkeypatch: pytest.MonkeyPatch,
):
    FakeHttpx("{not json at all").install(monkeypatch)

    with pytest.raises(InvalidOutputError) as caught:
        await gemini().call({"expects_json": True}, None)

    assert caught.value.detail["raw"] == "{not json at all"
    assert caught.value.detail["provider"] == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert caught.value.kind == "invalid_output"


async def test_transport_errors_map_to_model_failure(monkeypatch: pytest.MonkeyPatch):
    FakeHttpx(error=httpx.ConnectError("no route to host")).install(monkeypatch)

    with pytest.raises(ModelFailure) as caught:
        await gemini().call({"instruction": "x"}, None)

    assert caught.value.detail["error_type"] == "ConnectError"
    assert "Gemini could not answer" in str(caught.value)


async def test_an_http_error_status_maps_to_model_failure(
    monkeypatch: pytest.MonkeyPatch,
):
    FakeHttpx(status=401).install(monkeypatch)

    with pytest.raises(ModelFailure) as caught:
        await gemini().call({"instruction": "x"}, None)

    assert caught.value.detail["error_type"] == "HTTPStatusError"
    assert caught.value.detail["status_code"] == 401


async def test_an_httpx_timeout_maps_to_step_timeout(monkeypatch: pytest.MonkeyPatch):
    FakeHttpx(error=httpx.ReadTimeout("too slow")).install(monkeypatch)

    with pytest.raises(StepTimeout) as caught:
        await gemini().call({"instruction": "x"}, None)

    assert caught.value.detail["provider"] == f"gemini:{GEMINI_DEFAULT_MODEL}"


async def test_a_slow_openai_compat_call_raises_step_timeout(
    monkeypatch: pytest.MonkeyPatch,
):
    FakeHttpx(delay=0.2).install(monkeypatch)

    with pytest.raises(StepTimeout) as caught:
        await gemini(timeout_s=0.01).call({"instruction": "x"}, None)

    assert caught.value.detail["timeout_s"] == 0.01


async def test_an_empty_openai_compat_choice_list_is_a_model_failure(
    monkeypatch: pytest.MonkeyPatch,
):
    class Empty(FakeHttpx):
        def _client_class(self) -> Any:
            outer = super()._client_class()

            class Client(outer):  # type: ignore[misc, valid-type]
                async def post(self, url: str, json: Any = None) -> httpx.Response:
                    request = httpx.Request("POST", "https://provider.test/x")
                    return httpx.Response(200, json={"choices": []}, request=request)

            return Client

    Empty().install(monkeypatch)

    with pytest.raises(ModelFailure) as caught:
        await gemini().call({"instruction": "x"}, None)

    assert "no choices" in str(caught.value)


async def test_a_generic_openai_compatible_vendor_keeps_its_url_and_label(
    monkeypatch: pytest.MonkeyPatch,
):
    """The class is vendor-agnostic: any OpenAI-shaped endpoint can be wired up."""
    script = FakeHttpx("hi").install(monkeypatch)
    provider = OpenAICompatProvider(
        api_key="k", base_url="https://vendor.test/v1", model="vendor-1",
        provider_name="vendor",
    )

    result = await provider.call({"model": "vendor-2"}, None)

    assert result.provider_used == "vendor:vendor-2"
    assert script.client_kwargs[0]["base_url"] == "https://vendor.test/v1/"
    assert script.posts[0]["json"]["model"] == "vendor-2"


# -------------------------------------------------------------- resilient provider


class FailingPrimary:
    """A primary that always raises the error it was built with."""

    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = 0

    async def call(self, prompt_config: dict[str, Any], data: Any, provider: str | None = None):
        self.calls += 1
        raise self.error


class HealthyPrimary:
    def __init__(self) -> None:
        self.calls: list[tuple[dict[str, Any], Any, str | None]] = []

    async def call(self, prompt_config: dict[str, Any], data: Any, provider: str | None = None):
        from app.engine.ports import ModelResult

        self.calls.append((prompt_config, data, provider))
        return ModelResult(data={"live": True}, provider_used="groq:test", mocked=False)


async def test_resilient_uses_the_primary_when_it_works():
    primary = HealthyPrimary()
    resilient = ResilientModelProvider(primary, MockModelProvider(), primary_name="groq:test")

    result = await resilient.call(SUMMARY_PROMPT, {"a": 1})

    assert result.data == {"live": True}
    assert result.mocked is False
    assert resilient.fallback_count == 0


@pytest.mark.parametrize(
    "error",
    [ModelFailure("groq is down"), StepTimeout("groq hung"), RuntimeError("client bug")],
)
async def test_resilient_falls_back_to_mock_on_a_primary_outage(error: Exception):
    mock = MockModelProvider({"summarise_meeting": {"data": {"summary": "mocked"}}})
    resilient = ResilientModelProvider(
        FailingPrimary(error), mock, primary_name="groq:test"
    )

    result = await resilient.call(SUMMARY_PROMPT, {"a": 1})

    assert result.data == {"summary": "mocked"}
    assert result.mocked is True
    assert "auto-fallback" in result.provider_used
    assert "groq:test" in result.provider_used
    assert resilient.fallback_count == 1
    assert resilient.last_fallback["from"] == "groq:test"


async def test_resilient_does_not_swallow_invalid_output():
    resilient = ResilientModelProvider(
        FailingPrimary(InvalidOutputError("not json")), MockModelProvider()
    )

    with pytest.raises(InvalidOutputError):
        await resilient.call(SUMMARY_PROMPT, None)

    assert resilient.fallback_count == 0


async def test_resilient_honours_a_mock_provider_override_without_touching_the_primary():
    primary = HealthyPrimary()
    mock = MockModelProvider(
        {"route_ticket": {"data": "primary answer"}},
        responses_by_provider={"mock-backup": {"route_ticket": {"data": "backup answer"}}},
    )
    resilient = ResilientModelProvider(primary, mock)

    result = await resilient.call({"prompt_id": "route_ticket"}, None, "mock-backup")

    assert result.data == "backup answer"
    assert result.provider_used == "mock:mock-backup"
    assert primary.calls == []


async def test_without_a_primary_the_resilient_provider_is_simply_the_mock():
    resilient = ResilientModelProvider(None, MockModelProvider({"p": {"data": 1}}))

    result = await resilient.call({"prompt_id": "p"}, None)

    assert result.data == 1
    assert result.provider_used == "mock"
    assert resilient.mode == "mock"
    assert resilient.fallback_count == 0


async def test_an_override_naming_a_configured_live_provider_routes_to_it():
    primary = HealthyPrimary()
    alternate = HealthyPrimary()
    resilient = ResilientModelProvider(
        primary,
        MockModelProvider(),
        primary_name="groq:test",
        alternates={"gemini": alternate},
    )

    result = await resilient.call({"prompt_id": "p"}, None, "gemini")

    assert alternate.calls and primary.calls == []
    assert result.mocked is False
    assert resilient.fallback_count == 0


async def test_a_failing_alternate_falls_back_to_the_mock_with_its_own_label():
    primary = HealthyPrimary()
    resilient = ResilientModelProvider(
        primary,
        MockModelProvider({"p": {"data": "mocked"}}),
        primary_name="groq:test",
        alternates={"gemini": FailingPrimary(ModelFailure("gemini is down"))},
    )

    result = await resilient.call({"prompt_id": "p"}, None, "gemini")

    assert result.data == "mocked"
    assert result.mocked is True
    assert "auto-fallback" in result.provider_used
    assert "gemini" in result.provider_used
    assert resilient.fallback_count == 1
    assert resilient.last_fallback["from"].startswith("gemini")
    assert primary.calls == []


async def test_an_unconfigured_provider_override_still_lands_on_the_primary():
    primary = HealthyPrimary()
    resilient = ResilientModelProvider(
        primary, MockModelProvider(), primary_name="groq:test"
    )

    result = await resilient.call({"prompt_id": "p"}, None, "gemini")

    assert result.data == {"live": True}
    assert primary.calls[0][2] == "gemini"


async def test_a_mock_override_still_wins_over_a_live_alternate():
    """`mock-backup` is the puzzles' fallback target and must never go live."""
    alternate = HealthyPrimary()
    resilient = ResilientModelProvider(
        HealthyPrimary(),
        MockModelProvider(
            responses_by_provider={"mock-backup": {"p": {"data": "backup answer"}}}
        ),
        alternates={"gemini": alternate},
    )

    result = await resilient.call({"prompt_id": "p"}, None, "mock-backup")

    assert result.data == "backup answer"
    assert result.provider_used == "mock:mock-backup"
    assert alternate.calls == []


async def test_fallback_is_deterministic_across_repeated_outages():
    resilient = ResilientModelProvider(
        FailingPrimary(ModelFailure("down")), MockModelProvider()
    )

    first = await resilient.call(SUMMARY_PROMPT, {"a": 1})
    second = await resilient.call(SUMMARY_PROMPT, {"a": 1})

    assert first.model_dump() == second.model_dump()


# ------------------------------------------------------------------------ factory


def test_settings_read_the_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GROQ_MODEL", "llama-3.1-8b-instant")
    monkeypatch.setenv("GROQ_TIMEOUT_S", "5")

    settings = ProviderSettings.from_env()

    assert settings.groq_configured is True
    assert settings.live is True
    assert settings.groq_model == "llama-3.1-8b-instant"
    assert settings.timeout_s == 5.0


def test_settings_without_a_key_are_mock_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    settings = ProviderSettings.from_env()

    assert settings.groq_configured is False
    assert settings.live is False
    assert settings.provider_label == "mock"


def test_force_mock_pins_mock_mode_even_with_a_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("PUZZLE_FORCE_MOCK", "1")

    settings = ProviderSettings.from_env()

    assert settings.groq_configured is True
    assert settings.live is False


def test_build_model_port_without_a_key_has_no_primary(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    port = build_model_port()

    assert isinstance(port, ResilientModelProvider)
    assert port.primary is None
    assert port.mode == "mock"


def test_build_model_port_with_a_key_wraps_groq(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    port = build_model_port()

    assert isinstance(port.primary, GroqModelProvider)
    assert port.mode == "live"
    assert port.primary_name == f"groq:{DEFAULT_MODEL}"


async def test_a_built_port_serves_committed_puzzle_responses(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    settings = ProviderSettings.from_env(responses={"p": {"data": {"ok": True}}})

    result = await build_model_port(settings).call({"prompt_id": "p"}, None)

    assert result.data == {"ok": True}


def test_provider_status_reports_mock_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    assert provider_status() == {
        "mode": "mock",
        "provider": "mock",
        "groq_configured": False,
        "providers": {"groq": False, "gemini": False},
    }


def test_provider_status_reports_live_mode(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.delenv("PUZZLE_FORCE_MOCK", raising=False)

    assert provider_status() == {
        "mode": "live",
        "provider": f"groq:{DEFAULT_MODEL}",
        "groq_configured": True,
        "providers": {"groq": True, "gemini": False},
    }


# ---------------------------------------------------- multi-provider selection


def test_gemini_alone_becomes_the_primary(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")

    settings = ProviderSettings.from_env()
    port = build_model_port(settings)

    assert settings.primary_provider == "gemini"
    assert settings.live is True
    assert settings.groq_configured is False
    assert settings.provider_label == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert isinstance(port.primary, OpenAICompatProvider)
    assert port.alternates == {}
    assert provider_status(settings) == {
        "mode": "live",
        "provider": f"gemini:{GEMINI_DEFAULT_MODEL}",
        "groq_configured": False,
        "providers": {"groq": False, "gemini": True},
    }


def test_groq_wins_the_auto_order_and_gemini_becomes_an_alternate(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")

    settings = ProviderSettings.from_env()
    port = build_model_port(settings)

    assert settings.configured_providers == ("groq", "gemini")
    assert settings.primary_provider == "groq"
    assert isinstance(port.primary, GroqModelProvider)
    assert port.primary_name == f"groq:{DEFAULT_MODEL}"
    assert list(port.alternates) == ["gemini"]
    assert provider_status(settings)["providers"] == {"groq": True, "gemini": True}


def test_llm_provider_picks_the_primary_and_demotes_the_rest(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    settings = ProviderSettings.from_env()
    port = build_model_port(settings)

    assert settings.primary_provider == "gemini"
    assert settings.provider_label == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert isinstance(port.primary, OpenAICompatProvider)
    assert list(port.alternates) == ["groq"]
    assert provider_status(settings)["provider"] == f"gemini:{GEMINI_DEFAULT_MODEL}"
    # back-compat: a Groq key is still reported as configured
    assert provider_status(settings)["groq_configured"] is True


def test_llm_provider_naming_an_unconfigured_provider_falls_through(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    settings = ProviderSettings.from_env()

    assert settings.primary_provider == "groq"
    assert settings.provider_label == f"groq:{DEFAULT_MODEL}"


def test_llm_provider_is_ignored_when_nothing_is_configured(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    settings = ProviderSettings.from_env()

    assert settings.primary_provider is None
    assert settings.live is False
    assert settings.provider_label == "mock"


def test_force_mock_pins_mock_mode_with_every_key_set(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("PUZZLE_FORCE_MOCK", "1")

    settings = ProviderSettings.from_env()
    port = build_model_port(settings)

    assert settings.primary_provider is None
    assert port.primary is None
    assert port.mode == "mock"
    assert provider_status(settings) == {
        "mode": "mock",
        "provider": "mock",
        "groq_configured": True,
        "providers": {"groq": True, "gemini": True},
    }


def test_provider_models_are_overridable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-pro")

    settings = ProviderSettings.from_env()

    assert settings.gemini_model == "gemini-2.5-pro"
    assert settings.groq_model == DEFAULT_MODEL
    assert settings.provider_label == "gemini:gemini-2.5-pro"


async def test_a_built_multi_provider_port_routes_an_override_to_the_alternate(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("GEMINI_API_KEY", "gm_test")
    FakeHttpx('{"routed": "gemini"}').install(monkeypatch)

    port = build_model_port(ProviderSettings.from_env())
    result = await port.call({"prompt_id": "p", "expects_json": True}, None, "gemini")

    assert result.data == {"routed": "gemini"}
    assert result.provider_used == f"gemini:{GEMINI_DEFAULT_MODEL}"
    assert result.mocked is False


def test_load_env_ignores_empty_shadowing_variables(tmp_path, monkeypatch):
    """A set-but-empty provider var must not shadow the value in a .env file."""
    from app.providers import factory

    env_file = tmp_path / ".env"
    env_file.write_text(
        "GROQ_API_KEY=real-key-from-file\n"
        "GEMINI_API_KEY=real-gemini-key\n"
        "LLM_PROVIDER=gemini\n"
    )
    for key in ("GROQ_API_KEY", "GEMINI_API_KEY", "LLM_PROVIDER"):
        monkeypatch.setenv(key, "")

    loaded = factory.load_env([env_file])

    assert str(env_file) in loaded
    assert os.environ["GROQ_API_KEY"] == "real-key-from-file"
    assert os.environ["GEMINI_API_KEY"] == "real-gemini-key"
    assert os.environ["LLM_PROVIDER"] == "gemini"


# ------------------------------------------------------------ repair rounds

REPAIR_FEEDBACK = {
    "previous_output": {"category": "billing"},
    "issues": [
        {
            "field": "owner",
            "code": "missing_field",
            "message": "Required field 'owner' is missing.",
            "expected": "string",
            "actual": None,
        }
    ],
    "round": 1,
    "max_rounds": 2,
    "instruction": None,
    "output_field": "ticket",
}


async def test_mock_serves_the_repair_answer_when_feedback_is_attached():
    provider = MockModelProvider(
        {
            "summarise_meeting": {"data": {"summary": "x"}, "confidence": 0.5},
            "summarise_meeting#repair": {"data": {"summary": "fixed"}, "confidence": 0.9},
        }
    )

    plain = await provider.call(SUMMARY_PROMPT, None)
    repaired = await provider.call({**SUMMARY_PROMPT, "repair": REPAIR_FEEDBACK}, None)

    assert plain.data == {"summary": "x"}
    assert repaired.data == {"summary": "fixed"}
    assert repaired.confidence == 0.9
    assert repaired.mocked is True


async def test_mock_repair_falls_back_to_the_base_answer():
    provider = MockModelProvider({"summarise_meeting": {"data": {"summary": "same again"}}})

    repaired = await provider.call({**SUMMARY_PROMPT, "repair": REPAIR_FEEDBACK}, None)

    assert repaired.data == {"summary": "same again"}


async def test_mock_repair_honours_the_alternate_provider_table():
    provider = MockModelProvider(
        {"summarise_meeting": {"data": {"summary": "primary"}}},
        responses_by_provider={"mock-backup": {"summarise_meeting#repair": {"data": {"summary": "backup fix"}}}},
    )

    repaired = await provider.call(
        {**SUMMARY_PROMPT, "repair": REPAIR_FEEDBACK}, None, provider="mock-backup"
    )

    assert repaired.data == {"summary": "backup fix"}
    assert repaired.provider_used == "mock:mock-backup"
    assert provider.knows("summarise_meeting#repair", "mock-backup")


def test_auto_prompt_id_ignores_repair_feedback():
    config = {"prompt": "Route the ticket", "expects_json": True}

    assert prompt_id_for(config) == prompt_id_for({**config, "repair": REPAIR_FEEDBACK})


async def test_unknown_repair_prompt_synthesises_a_stable_but_different_answer():
    first = await MockModelProvider().call({**SUMMARY_PROMPT, "repair": REPAIR_FEEDBACK}, None)
    again = await MockModelProvider().call({**SUMMARY_PROMPT, "repair": REPAIR_FEEDBACK}, None)
    plain = await MockModelProvider().call(SUMMARY_PROMPT, None)

    assert first.model_dump() == again.model_dump()
    assert first.data["prompt_id"] == "summarise_meeting#repair"
    assert first.data != plain.data


def test_build_messages_appends_the_repair_feedback_before_the_input_data():
    provider, _ = groq_provider()

    messages = provider.build_messages(
        {"instruction": "Pick a category.", "expects_json": True, "repair": REPAIR_FEEDBACK},
        {"ticket": "TCK-1"},
    )
    user = messages[1]["content"]

    assert REPAIR_INSTRUCTION in user
    assert "Your answer is stored under the field 'ticket'." in user
    assert "Your previous answer (JSON):" in user
    assert '"category": "billing"' in user
    assert "Problems found (repair attempt 1 of 2):" in user
    assert "- owner: Required field 'owner' is missing. Expected: string." in user
    assert user.index("Pick a category.") < user.index("Problems found")
    assert user.index("Problems found") < user.index("Input data (JSON)")
    assert '"ticket": "TCK-1"' in user


def test_build_messages_uses_a_custom_repair_instruction():
    provider, _ = groq_provider()

    messages = provider.build_messages(
        {"instruction": "Pick a category.", "repair": {**REPAIR_FEEDBACK, "instruction": "Fix it now."}},
        {"ticket": 1},
    )

    assert "Fix it now." in messages[1]["content"]
    assert REPAIR_INSTRUCTION not in messages[1]["content"]


def test_openai_compat_builds_exactly_the_groq_repair_messages():
    config = {"instruction": "Pick a category.", "expects_json": True, "repair": REPAIR_FEEDBACK}
    groq_side, _ = groq_provider()

    assert gemini().build_messages(config, {"ticket": 1}) == groq_side.build_messages(
        config, {"ticket": 1}
    )
