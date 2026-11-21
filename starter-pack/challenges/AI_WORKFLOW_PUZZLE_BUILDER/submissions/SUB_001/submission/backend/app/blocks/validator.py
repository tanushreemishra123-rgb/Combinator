"""Validator block.

Responsibility: check the current data against a small JSON-schema-like shape plus
an optional confidence floor, and report *every* problem it finds as a structured
:class:`ValidationResult`. Deciding what to do about a failure (fail, retry
upstream, send the answer back for repair, ask a human, fall back to a safe
default) is the executor's job - this block only states the on-fail policy it
was configured with.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import ConfigDict, Field

from app.blocks.base import (
    MISSING,
    Block,
    BlockConfig,
    BlockContext,
    BlockResult,
    get_path,
)
from app.engine.model import BlockType
from app.engine.run import ValidationIssue, ValidationResult

OnFail = Literal["fail", "retry_upstream", "repair", "human_review", "safe_default"]

_TYPE_NAMES: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "number": (int, float),
    "integer": (int,),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


class FieldRule(BlockConfig):
    """The rules applied to one field."""

    type: str | None = None
    required: bool = True
    allowed: list[Any] | None = None
    min: float | None = None
    max: float | None = None


class ValidatorConfig(BlockConfig):
    """The schema to enforce and what to do when it is not met.

    The field is named ``field_schema`` internally (``schema`` shadows a pydantic
    attribute) but is read and written as ``schema`` in workflow JSON.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    field_schema: dict[str, Any] = Field(default_factory=dict, alias="schema")
    confidence_threshold: float | None = None
    on_fail: OnFail = "fail"
    safe_default: Any = None
    review_prompt: str | None = None
    #: ``repair``: how many times the upstream AI step may be asked to fix its answer.
    max_repairs: int = Field(default=1, ge=1, le=5)
    #: ``repair``: optional wording for the fix-it instruction sent back to the model.
    repair_prompt: str | None = None


class ValidatorBlock(Block):
    """Produces a structured pass/fail report for the current data."""

    type = BlockType.VALIDATOR
    config_model = ValidatorConfig

    async def execute(self, ctx: BlockContext) -> BlockResult:
        config: ValidatorConfig = ctx.config  # type: ignore[assignment]
        confidence = _resolve_confidence(ctx)
        issues = _check(config, ctx.data, confidence)
        result = ValidationResult(
            passed=not issues,
            issues=issues,
            confidence=confidence,
            checked_fields=list(config.field_schema.keys()),
        )
        return BlockResult(
            data=ctx.data,
            validation=result,
            confidence=confidence,
            meta={"on_fail": config.on_fail, "passed": result.passed},
        )


def _resolve_confidence(ctx: BlockContext) -> float | None:
    """Prefer the last model call's confidence, else a ``confidence`` field in data."""
    if ctx.confidence is not None:
        return ctx.confidence
    value = get_path(ctx.data, "confidence", MISSING)
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _check(
    config: ValidatorConfig, data: Any, confidence: float | None
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    if config.field_schema and not isinstance(data, dict):
        issues.append(
            ValidationIssue(
                field=None,
                code="not_an_object",
                message="Expected structured object data to validate.",
                expected="object",
                actual=type(data).__name__,
            )
        )
        return issues

    for field_name, raw_rule in config.field_schema.items():
        rule = raw_rule if isinstance(raw_rule, FieldRule) else FieldRule.model_validate(
            raw_rule if isinstance(raw_rule, dict) else {"type": raw_rule}
        )
        value = get_path(data, field_name, MISSING)
        if value is MISSING or value is None:
            if rule.required:
                issues.append(
                    ValidationIssue(
                        field=field_name,
                        code="missing_field",
                        message=f"Required field '{field_name}' is missing.",
                        expected=rule.type,
                        actual=None,
                    )
                )
            continue
        issues.extend(_check_value(field_name, rule, value))

    if config.confidence_threshold is not None:
        if confidence is None:
            issues.append(
                ValidationIssue(
                    field="confidence",
                    code="missing_confidence",
                    message="No confidence score was reported for this result.",
                    expected=config.confidence_threshold,
                    actual=None,
                )
            )
        elif confidence < config.confidence_threshold:
            issues.append(
                ValidationIssue(
                    field="confidence",
                    code="low_confidence",
                    message=(
                        f"Confidence {confidence} is below the required "
                        f"{config.confidence_threshold}."
                    ),
                    expected=config.confidence_threshold,
                    actual=confidence,
                )
            )
    return issues


def _check_value(field_name: str, rule: FieldRule, value: Any) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if rule.type:
        expected_types = _TYPE_NAMES.get(rule.type)
        ok = expected_types is not None and isinstance(value, expected_types)
        if rule.type in {"number", "integer"} and isinstance(value, bool):
            ok = False
        if not ok:
            issues.append(
                ValidationIssue(
                    field=field_name,
                    code="wrong_type",
                    message=(
                        f"Field '{field_name}' should be a {rule.type} but was "
                        f"{type(value).__name__}."
                    ),
                    expected=rule.type,
                    actual=type(value).__name__,
                )
            )
            return issues

    if rule.allowed is not None and value not in rule.allowed:
        issues.append(
            ValidationIssue(
                field=field_name,
                code="not_allowed",
                message=(
                    f"Field '{field_name}' is {value!r}, which is not one of the "
                    "allowed values."
                ),
                expected=rule.allowed,
                actual=value,
            )
        )

    measure = _measure(value)
    if measure is not None:
        if rule.min is not None and measure < rule.min:
            issues.append(
                ValidationIssue(
                    field=field_name,
                    code="below_min",
                    message=f"Field '{field_name}' is below the minimum {rule.min}.",
                    expected=rule.min,
                    actual=measure,
                )
            )
        if rule.max is not None and measure > rule.max:
            issues.append(
                ValidationIssue(
                    field=field_name,
                    code="above_max",
                    message=f"Field '{field_name}' is above the maximum {rule.max}.",
                    expected=rule.max,
                    actual=measure,
                )
            )
    return issues


def _measure(value: Any) -> float | None:
    """Numbers compare by value; strings and collections compare by length."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, (str, list, tuple, dict, set)):
        return float(len(value))
    return None
