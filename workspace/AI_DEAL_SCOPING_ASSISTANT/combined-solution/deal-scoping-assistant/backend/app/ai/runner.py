"""LangGraph stage runner: generate -> validate -> repair -> generate, or fail."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Generic, TypedDict, TypeVar

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.ai.errors import (
    AiNotConfigured,
    AiProviderUnavailable,
    AiRequestTooLarge,
    MockResponseMissing,
)
from app.ai.findings import Finding, error, errors_only, warnings_only
from app.ai.provider import StructuredGenerator
from app.core.errors import AIStageFailed

# Classic TypeVar rather than PEP 695 syntax: the SAST scanner cannot parse the new form.
T = TypeVar("T", bound=BaseModel)

# A validator sees the parsed object and reports what is wrong with it.
Validator = Callable[[Any], list[Finding]]


@dataclass
class StageRequest(Generic[T]):
    """One call to the model: what to ask, what shape to expect, how to check it."""

    stage: str
    schema: type[T]
    system: str
    user: str
    validators: Sequence[Validator] = field(default_factory=tuple)


@dataclass
class StageResult(Generic[T]):
    result: T
    warnings: list[Finding]


class _State(TypedDict):
    attempts: int
    repair_notes: list[str]
    result: Any
    findings: list[Finding]


def _repair_message(findings: list[Finding]) -> str:
    lines = [
        f"- {f.message} (ids: {', '.join(f.ids)})" if f.ids else f"- {f.message}" for f in findings
    ]
    return (
        "Your previous answer was rejected by the validator:\n"
        + "\n".join(lines)
        + "\nReturn the complete object again with those problems fixed. Change nothing else. "
        "If the answer was cut off, write shorter descriptions so the whole object fits."
    )


def run_stage(
    generator: StructuredGenerator,
    request: StageRequest[T],
    max_repair_attempts: int = 2,
) -> StageResult[T]:
    """Run one stage to a validated object, repairing at most `max_repair_attempts` times."""

    def generate(state: _State) -> _State:
        user = "\n\n".join([request.user, *state["repair_notes"]])
        try:
            result = generator.generate(request.stage, request.schema, request.system, user)
        except (
            AiNotConfigured,
            AiProviderUnavailable,
            AiRequestTooLarge,
            MockResponseMissing,
        ):
            # Missing provider or recording, a prompt over the token budget, or a provider
            # that stays unavailable: the model cannot repair any of these.
            raise
        except Exception as exc:  # schema or provider failure: feed it back as a repair note
            return {**state, "result": None, "findings": [error(f"{type(exc).__name__}: {exc}")]}
        return {**state, "result": result, "findings": []}

    def validate(state: _State) -> _State:
        if state["result"] is None:
            return state
        findings: list[Finding] = []
        for validator in request.validators:
            findings.extend(validator(state["result"]))
        return {**state, "findings": findings}

    def repair(state: _State) -> _State:
        note = _repair_message(errors_only(state["findings"]))
        return {**state, "attempts": state["attempts"] + 1, "repair_notes": [note]}

    def route(state: _State) -> str:
        if not errors_only(state["findings"]):
            return "ok"
        return "repair" if state["attempts"] < max_repair_attempts else "fail"

    graph = StateGraph(_State)
    graph.add_node("generate", generate)
    graph.add_node("validate", validate)
    graph.add_node("repair", repair)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "validate")
    graph.add_conditional_edges("validate", route, {"ok": END, "repair": "repair", "fail": END})
    graph.add_edge("repair", "generate")

    start: _State = {"attempts": 0, "repair_notes": [], "result": None, "findings": []}
    final = graph.compile().invoke(start)

    blocking = errors_only(list(final["findings"]))
    if blocking or final["result"] is None:
        raise AIStageFailed(
            f"stage {request.stage} failed validation after {final['attempts']} repair attempts",
            errors=[f.message for f in blocking],
        )
    result: T = final["result"]
    return StageResult(result=result, warnings=warnings_only(list(final["findings"])))
