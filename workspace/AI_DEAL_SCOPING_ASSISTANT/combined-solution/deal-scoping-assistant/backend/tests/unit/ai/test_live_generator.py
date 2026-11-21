"""Pacing, rate-limit waiting and the too-large message, with a fake provider."""

from typing import Any

import pytest
from pydantic import Field

from app.ai.errors import AiProviderUnavailable, AiRequestTooLarge
from app.ai.provider import STRUCTURED_OUTPUT_METHOD, LiveGenerator
from app.ai.rate_limit import BUDGET_TOO_SMALL_MESSAGE, MAX_WAITS, wait_seconds
from app.core.config import AiProvider
from app.core.errors import AIStageFailed
from app.domain.base import DomainModel


class Answer(DomainModel):
    value: str = Field(description="Answer value.")


class FakeResponse:
    def __init__(self, status: int, headers: dict[str, str]) -> None:
        self.status_code = status
        self.headers = headers


class ProviderError(Exception):
    def __init__(self, status: int, message: str = "", headers: dict[str, str] | None = None):
        super().__init__(message or f"error {status}")
        self.response = FakeResponse(status, headers or {})


class FakeStructured:
    def __init__(self, answers: list[Any]) -> None:
        self.answers = answers
        self.calls = 0

    def invoke(self, _messages: object) -> Any:
        self.calls += 1
        answer = self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]
        if isinstance(answer, Exception):
            raise answer
        return answer


class FakeModel:
    def __init__(self, answers: list[Any]) -> None:
        self.structured = FakeStructured(answers)
        self.options: dict[str, object] = {}

    def with_structured_output(self, _schema: object, **kwargs: object) -> FakeStructured:
        self.options = dict(kwargs)
        return self.structured


def make_generator(answers: list[Any]) -> tuple[LiveGenerator, list[float]]:
    slept: list[float] = []
    model = FakeModel(answers)
    generator = LiveGenerator(
        model=model,  # type: ignore[arg-type]
        method="json_schema",
        label="live:fake/model",
        sleep=slept.append,
    )
    return generator, slept


def ok(value: str = "good") -> dict[str, Any]:
    return {"parsed": Answer(value=value), "raw": None, "parsing_error": None}


def test_a_successful_call_records_usage() -> None:
    class Raw:
        usage_metadata = {"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}

    generator, slept = make_generator(
        [{"parsed": Answer(value="good"), "raw": Raw(), "parsing_error": None}]
    )
    assert generator.generate("demo", Answer, "system", "user").value == "good"
    assert generator.usage == [
        ("demo", {"input_tokens": 100, "output_tokens": 20, "total_tokens": 120})
    ]
    assert slept == []


def test_rate_limit_waits_for_the_provider_and_retries() -> None:
    limited = ProviderError(429, "rate limited", {"retry-after": "7"})
    generator, slept = make_generator([limited, ok()])
    assert generator.generate("demo", Answer, "system", "user").value == "good"
    assert slept == [7.0]


def test_rate_limit_gives_up_after_three_waits() -> None:
    generator, slept = make_generator([ProviderError(429, "rate limited", {"retry-after": "2"})])
    with pytest.raises(AiProviderUnavailable):
        generator.generate("demo", Answer, "system", "user")
    assert slept == [2.0] * MAX_WAITS


def test_a_request_over_the_token_limit_is_not_retried() -> None:
    too_large = ProviderError(
        413,
        "Request too large for model: Limit 8000, Requested 8939",
        {"x-ratelimit-limit-tokens": "8000"},
    )
    generator, slept = make_generator([too_large])
    with pytest.raises(AiRequestTooLarge) as raised:
        generator.generate("prd", Answer, "system", "user")
    assert raised.value.detail == BUDGET_TOO_SMALL_MESSAGE
    assert slept == []
    assert generator.model.structured.calls == 1  # type: ignore[attr-defined]


def test_an_empty_groq_generation_is_reported_as_a_budget_problem() -> None:
    """Groq answers a schema it cannot fill inside its budget with an empty generation."""
    empty = ProviderError(
        400,
        "Failed to validate JSON. ... 'code': 'json_validate_failed', 'failed_generation': ''",
    )
    generator, slept = make_generator([empty])
    with pytest.raises(AiRequestTooLarge) as raised:
        generator.generate("architecture", Answer, "system", "user")
    assert raised.value.detail == BUDGET_TOO_SMALL_MESSAGE
    assert slept == []


def test_an_overloaded_model_is_waited_out_like_a_rate_limit() -> None:
    busy = ProviderError(503, "The model is currently experiencing high demand")
    generator, slept = make_generator([busy, ok()])
    assert generator.generate("prd", Answer, "system", "user").value == "good"
    assert slept == [20.0]


def test_a_parsing_error_is_reported_so_the_runner_can_repair() -> None:
    generator, _ = make_generator([{"parsed": None, "raw": None, "parsing_error": "bad json"}])
    with pytest.raises(AIStageFailed):
        generator.generate("demo", Answer, "system", "user")


GEMINI_QUOTA_ERROR = (
    "Error calling model 'gemini-flash' (RESOURCE_EXHAUSTED): 429 RESOURCE_EXHAUSTED. "
    "{'error': {'code': 429, 'message': 'You exceeded your current quota. "
    "Please retry in 12.5s.'}}"
)


def test_a_provider_that_only_puts_the_status_in_the_message_is_retried() -> None:
    generator, slept = make_generator([Exception(GEMINI_QUOTA_ERROR), ok()])
    assert generator.generate("prd", Answer, "system", "user").value == "good"
    assert slept == [12.5]


def test_each_provider_gets_its_structured_output_method() -> None:
    assert STRUCTURED_OUTPUT_METHOD[AiProvider.GOOGLE_GENAI] == "json_schema"
    assert STRUCTURED_OUTPUT_METHOD[AiProvider.GROQ] == "json_schema"
    generator, _ = make_generator([ok()])
    generator.method = STRUCTURED_OUTPUT_METHOD[AiProvider.GOOGLE_GENAI]
    generator.generate("demo", Answer, "system", "user")
    assert generator.model.options == {"method": "json_schema", "include_raw": True}  # type: ignore[attr-defined]


def test_wait_seconds_reads_the_reset_header_and_the_message() -> None:
    assert wait_seconds(ProviderError(429, "x", {"x-ratelimit-reset-tokens": "7.66s"})) == 7.66
    assert wait_seconds(ProviderError(429, "Please try again in 1.5s")) == 1.5
    assert wait_seconds(ProviderError(429, "no hint")) == 20.0
    assert wait_seconds(ProviderError(429, "x", {"retry-after": "500"})) == 90.0
    assert wait_seconds(Exception("... 'retryDelay': '49s' ...")) == 49.0
