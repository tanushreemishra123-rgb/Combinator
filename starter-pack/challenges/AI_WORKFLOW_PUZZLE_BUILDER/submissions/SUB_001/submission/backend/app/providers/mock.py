"""Deterministic mock model provider.

Responsibility: answer every model call without a network, a key, or a random
number, so a reviewer can run every puzzle end to end with zero setup and get the
*same* trace every time.

Two layers of determinism:

* **Canned responses** - a puzzle commits ``{prompt_id: response_spec}`` and the
  provider replays them verbatim. This is how the seeded puzzles produce
  believable AI output.
* **Synthesised responses** - an unknown ``prompt_id`` still gets an answer,
  derived only from ``(prompt_id, task hint, provider)`` via a SHA-256 digest.
  Same inputs, same answer, forever - no clocks, no randomness, no input echo.

A ``responses_by_provider`` map lets an *alternate* provider (the Fallback
block's ``provider="mock-backup"``) return a different canned answer than the
primary, which is what makes the fallback visibly rescue a failed step.

A **repair round** (a Validator with ``on_fail: repair`` sending the rejected
answer back) is served from ``"<prompt_id>#repair"`` when the puzzle commits one,
and falls back to the base ``prompt_id`` answer otherwise - "the model said the
same thing again", which is what makes an exhausted repair budget reproducible.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.engine.ports import ModelResult

DEFAULT_CONFIDENCE = 0.92
"""Confidence reported for a canned response that does not declare one."""

#: Keys of a response spec mapping. A mapping carrying any of these is treated as
#: a spec; anything else is used as the response *data* itself.
SPEC_KEYS = frozenset({"data", "confidence", "raw"})

#: Prompt-config keys consulted, in order, for the "what is this step doing?" hint
#: that seeds a synthesised answer.
HINT_KEYS = ("task", "instruction", "prompt", "label", "system")

#: Appended to a prompt id to file the answer served on a repair round.
REPAIR_SUFFIX = "#repair"


class MockModelProvider:
    """A :class:`~app.engine.ports.ModelPort` that never leaves the process.

    Args:
        responses: ``{prompt_id: response_spec}`` used for every provider.
        responses_by_provider: ``{provider_name: {prompt_id: response_spec}}``,
            consulted first when the caller asks for a specific provider (e.g.
            the Fallback block's ``mock-backup``).
        default_confidence: confidence for canned specs that omit one.

    A ``response_spec`` is either a bare value (used as ``ModelResult.data``) or a
    mapping with any of ``{"data", "confidence", "raw"}``.
    """

    def __init__(
        self,
        responses: dict[str, Any] | None = None,
        *,
        responses_by_provider: dict[str, dict[str, Any]] | None = None,
        default_confidence: float = DEFAULT_CONFIDENCE,
    ) -> None:
        self.responses: dict[str, Any] = dict(responses or {})
        self.responses_by_provider: dict[str, dict[str, Any]] = {
            name: dict(table) for name, table in (responses_by_provider or {}).items()
        }
        self.default_confidence = default_confidence

    # ------------------------------------------------------------------ port

    async def call(
        self, prompt_config: dict[str, Any], data: Any, provider: str | None = None
    ) -> ModelResult:
        """Return the canned (or synthesised) answer for this prompt."""
        prompt_id = prompt_id_for(prompt_config)
        repairing = bool((prompt_config or {}).get("repair"))
        spec = self._lookup(f"{prompt_id}{REPAIR_SUFFIX}", provider) if repairing else None
        if spec is None:
            spec = self._lookup(prompt_id, provider)
        if spec is None:
            return self._synthesise(
                f"{prompt_id}{REPAIR_SUFFIX}" if repairing else prompt_id,
                prompt_config,
                provider,
            )

        confidence = spec.get("confidence", self.default_confidence)
        answer = spec.get("data")
        return ModelResult(
            data=answer,
            confidence=None if confidence is None else float(confidence),
            raw=str(spec.get("raw") or _dumps(answer)),
            provider_used=self.provider_name(provider),
            mocked=True,
        )

    # --------------------------------------------------------------- helpers

    def provider_name(self, provider: str | None = None) -> str:
        """How this answer is labelled in the trace (``mock`` / ``mock:<alt>``)."""
        if not provider or provider == "mock":
            return "mock"
        return f"mock:{provider}"

    def knows(self, prompt_id: str, provider: str | None = None) -> bool:
        """Whether a canned response exists (useful for puzzle self-checks)."""
        return self._lookup(prompt_id, provider) is not None

    def _lookup(self, prompt_id: str, provider: str | None) -> dict[str, Any] | None:
        """Alternate-provider table first, then the shared table."""
        if provider:
            table = self.responses_by_provider.get(provider)
            if table is not None and prompt_id in table:
                return _as_spec(table[prompt_id])
        if prompt_id in self.responses:
            return _as_spec(self.responses[prompt_id])
        return None

    def _synthesise(
        self, prompt_id: str, prompt_config: dict[str, Any], provider: str | None
    ) -> ModelResult:
        """Build a stable answer from ``(prompt_id, task hint, provider)`` alone.

        Never looks at the incoming data, so replaying a run with different input
        cannot make an unknown prompt drift.
        """
        hint = _hint(prompt_config)
        seed = f"{prompt_id}|{hint}|{provider or ''}"
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        # 0.60 .. 0.95, stable per seed.
        confidence = round(0.60 + (int(digest[:4], 16) % 3500) / 10000, 4)
        answer = {
            "mock": True,
            "prompt_id": prompt_id,
            "task": hint,
            "summary": (
                f"Deterministic mock answer for {hint or prompt_id!r} "
                "(no canned response was committed for this prompt)."
            ),
            "fingerprint": digest[:12],
        }
        return ModelResult(
            data=answer,
            confidence=confidence,
            raw=_dumps(answer),
            provider_used=self.provider_name(provider),
            mocked=True,
        )


# --------------------------------------------------------------------- module


def prompt_id_for(prompt_config: dict[str, Any]) -> str:
    """The key a canned response is filed under.

    Uses ``prompt_config["prompt_id"]`` when the puzzle sets one (it always
    should); otherwise derives a stable ``auto:<digest>`` id from the prompt's
    own text so the same block keeps the same identity across runs.
    """
    declared = (prompt_config or {}).get("prompt_id")
    if declared:
        return str(declared)
    material = {key: (prompt_config or {}).get(key) for key in HINT_KEYS}
    material["output_format"] = (prompt_config or {}).get("output_format")
    digest = hashlib.sha256(_dumps(material).encode("utf-8")).hexdigest()
    return f"auto:{digest[:16]}"


def _as_spec(value: Any) -> dict[str, Any]:
    """Normalise a committed response into ``{data, confidence?, raw?}``."""
    if isinstance(value, dict) and SPEC_KEYS.intersection(value):
        return dict(value)
    return {"data": value}


def _hint(prompt_config: dict[str, Any]) -> str:
    for key in HINT_KEYS:
        value = (prompt_config or {}).get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _dumps(value: Any) -> str:
    """Canonical JSON so digests and ``raw`` text never depend on dict order."""
    return json.dumps(value, sort_keys=True, default=str)
