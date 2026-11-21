"""Prompt shaping and response parsing shared by every chat-completions provider.

Responsibility: the parts of "talk to a chat model" that are identical whichever
vendor answers - how a block's prompt config becomes chat messages, how we decide
a structured answer was asked for, how a fenced or self-reporting reply is read
back.

:mod:`app.providers.groq` and :mod:`app.providers.openai_compat` both build on
these so a Groq run and a Gemini run send the *same* prompt and interpret the
answer the same way. Anything vendor-specific (client construction, error classes,
trace labels) stays in the provider module.
"""

from __future__ import annotations

import json
from typing import Any

from app.engine.errors import ModelFailure

DEFAULT_SYSTEM = (
    "You are a reliable step inside an automated workflow. "
    "Answer only with what the instruction asks for."
)
JSON_SYSTEM_SUFFIX = (
    " Reply with a single valid JSON object and nothing else - no prose, "
    "no markdown fence."
)
REPAIR_INSTRUCTION = (
    "Your previous answer to this instruction was rejected by a validation step. "
    "Fix every problem listed below and reply with the complete corrected answer "
    "in the same format. Do not explain and do not apologise."
)


def wants_json(prompt_config: dict[str, Any]) -> bool:
    """True when the block declares a structured answer is expected."""
    if (prompt_config or {}).get("expects_json"):
        return True
    return bool((prompt_config or {}).get("output_format"))


def build_messages(prompt_config: dict[str, Any], data: Any) -> list[dict[str, str]]:
    """Compose the chat messages: system rules, instruction, format, data.

    The current workflow data is always serialised as JSON in the user turn, so a
    block sees exactly what the previous step produced.
    """
    prompt_config = prompt_config or {}
    system = str(prompt_config.get("system") or DEFAULT_SYSTEM).strip()
    if wants_json(prompt_config):
        system = f"{system}{JSON_SYSTEM_SUFFIX}"

    parts: list[str] = []
    instruction = prompt_config.get("instruction") or prompt_config.get("prompt")
    if instruction:
        parts.append(str(instruction).strip())
    output_format = prompt_config.get("output_format")
    if output_format:
        shape = (
            output_format
            if isinstance(output_format, str)
            else json.dumps(output_format, indent=2, sort_keys=True, default=str)
        )
        parts.append(f"Respond with JSON in exactly this shape:\n{shape}")
    repair = prompt_config.get("repair")
    if isinstance(repair, dict):
        parts.append(render_repair(repair))
    parts.append(
        "Input data (JSON):\n" + json.dumps(data, indent=2, sort_keys=True, default=str)
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n\n".join(parts)},
    ]


def render_repair(repair: dict[str, Any]) -> str:
    """The fix-it section of a repair round: the rejected answer and its problems.

    ``repair`` is the JSON form of :class:`app.engine.run.RepairRequest`.
    """
    lines: list[str] = [str(repair.get("instruction") or REPAIR_INSTRUCTION).strip()]
    output_field = repair.get("output_field")
    if output_field:
        lines.append(f"Your answer is stored under the field '{output_field}'.")
    lines.append(
        "Your previous answer (JSON):\n"
        + json.dumps(repair.get("previous_output"), indent=2, sort_keys=True, default=str)
    )
    round_number = repair.get("round") or 1
    max_rounds = repair.get("max_rounds") or round_number
    lines.append(f"Problems found (repair attempt {round_number} of {max_rounds}):")
    for issue in repair.get("issues") or []:
        if not isinstance(issue, dict):
            continue
        where = issue.get("field") or "answer"
        line = f"- {where}: {issue.get('message') or issue.get('code') or 'invalid'}"
        if issue.get("expected") is not None:
            line += f" Expected: {issue['expected']}."
        lines.append(line)
    return "\n".join(lines)


def extract_message_text(completion: Any, *, provider_label: str, brand: str) -> str:
    """Pull the assistant message out of a completion (object or dict shaped).

    Args:
        completion: the vendor's response - an SDK object or a parsed JSON body.
        provider_label: trace label recorded in the error detail, e.g. ``gemini:...``.
        brand: how the vendor is named in the error message, e.g. ``Gemini``.
    """
    choices = get(completion, "choices") or []
    if not choices:
        raise ModelFailure(
            f"{brand} returned no choices.",
            detail={"provider": provider_label},
        )
    message = get(choices[0], "message")
    content = get(message, "content")
    if content is None:
        raise ModelFailure(
            f"{brand} returned an empty message.",
            detail={"provider": provider_label},
        )
    return str(content)


def get(source: Any, key: str) -> Any:
    """Read ``key`` from a mapping or an attribute-shaped SDK object."""
    if isinstance(source, dict):
        return source.get(key)
    return getattr(source, key, None)


def strip_fence(text: str) -> str:
    """Remove a ```json fence if a model wrapped its object in one."""
    stripped = (text or "").strip()
    if not stripped.startswith("```"):
        return stripped
    body = stripped[3:]
    if body.lower().startswith("json"):
        body = body[4:]
    return body.rsplit("```", 1)[0].strip()


def confidence_of(parsed: Any) -> float | None:
    """Read a self-reported ``confidence`` if the model included a sane one."""
    if not isinstance(parsed, dict):
        return None
    value = parsed.get("confidence")
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not 0.0 <= float(value) <= 1.0:
        return None
    return float(value)
