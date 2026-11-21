"""The repair loop: generate -> validate -> repair -> generate, then fail."""

import pytest
from pydantic import Field

from app.ai.findings import Finding, error, warning
from app.ai.runner import StageRequest, run_stage
from app.core.errors import AIStageFailed
from app.domain.base import DomainModel
from tests.unit.ai.conftest import ScriptedGenerator


class Answer(DomainModel):
    value: str = Field(description="Answer value.")


def only_good(content: Answer) -> list[Finding]:
    return [] if content.value == "good" else [error(f"value '{content.value}' is not allowed")]


def request(validators: list[object]) -> StageRequest[Answer]:
    return StageRequest(
        stage="demo",
        schema=Answer,
        system="system",
        user="user",
        validators=validators,  # type: ignore[arg-type]
    )


def test_valid_first_answer_runs_once() -> None:
    generator = ScriptedGenerator({"demo": [Answer(value="good")]})
    result = run_stage(generator, request([only_good]))
    assert result.result.value == "good"
    assert result.warnings == []
    assert len(generator.calls) == 1


def test_one_failure_is_repaired() -> None:
    generator = ScriptedGenerator({"demo": [Answer(value="bad"), Answer(value="good")]})
    result = run_stage(generator, request([only_good]), max_repair_attempts=2)
    assert result.result.value == "good"
    assert len(generator.calls) == 2
    assert "not allowed" in generator.calls[1][1]  # the validator message is sent back


def test_permanent_failure_raises_with_messages() -> None:
    generator = ScriptedGenerator({"demo": [Answer(value="bad")]})
    with pytest.raises(AIStageFailed) as raised:
        run_stage(generator, request([only_good]), max_repair_attempts=2)
    assert raised.value.errors == ["value 'bad' is not allowed"]
    assert len(generator.calls) == 3  # first attempt plus two repairs


def test_generator_exception_is_repaired() -> None:
    generator = ScriptedGenerator({"demo": [ValueError("bad json"), Answer(value="good")]})
    result = run_stage(generator, request([only_good]))
    assert result.result.value == "good"
    assert "bad json" in generator.calls[1][1]


def test_warnings_reach_the_caller() -> None:
    generator = ScriptedGenerator({"demo": [Answer(value="good")]})
    result = run_stage(generator, request([lambda _: [warning("check this", ["FR_01"])]]))
    assert [finding.message for finding in result.warnings] == ["check this"]
