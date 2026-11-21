"""Simulated external tools.

Responsibility: give Tool blocks believable, *deterministic* external systems - a
knowledge search, a ticket system, a messenger, a web fetcher and a calculator -
without a single network call. Every tool is a pure function of
``(fixtures, config, data)``: no clocks, no randomness, so a run replays
identically forever.

Each puzzle commits its own ``fixtures`` (Task 4) in this shape::

    {
      "knowledge_search": {
        "documents": {"<normalised query>": [{"id", "title", "snippet", ...}]},
        "default": [ ... ]                      # optional catch-all
      },
      "ticket_lookup": {"tickets": {"TCK-4821": {...ticket metadata...}}},
      "web_fetch": {"sources": {"acme-blog": {"url", "title", "content"}}},
    }

Anything not committed is synthesised deterministically from the lookup key, so a
half-configured puzzle still runs and still replays the same way.

Two config keys work on *every* tool and exist so a puzzle can stage a realistic
failure without the injector:

``simulate_delay_ms``
    Sleep this long before answering - lets a Timeout guard fire for real.
``simulate_error``
    Raise :class:`~app.engine.errors.ToolFailure` with this message.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import operator
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from app.blocks.base import MISSING, get_path
from app.engine.errors import ToolFailure

ToolFn = Callable[[dict[str, Any], Any], Awaitable[Any]]

PRIORITIES = ("low", "normal", "high", "urgent")
PRODUCT_AREAS = ("billing", "onboarding", "integrations", "reporting", "mobile")
TICKET_STATUSES = ("open", "pending", "escalated")

# ------------------------------------------------------- calculator arithmetic
# Named functions rather than lambdas so every operation the calculator offers
# has a real name in a traceback. No ``eval`` anywhere near this file.


def _agg_sum(values: Sequence[float]) -> float:
    """Total of ``values`` (0.0 when empty)."""
    return float(sum(values))


def _agg_count(values: Sequence[float]) -> float:
    """How many numbers were collected."""
    return float(len(values))


def _agg_mean(values: Sequence[float]) -> float:
    """Arithmetic mean; the caller rejects an empty list first."""
    return float(sum(values) / len(values))


def _agg_min(values: Sequence[float]) -> float:
    """Smallest value; the caller rejects an empty list first."""
    return float(min(values))


def _agg_max(values: Sequence[float]) -> float:
    """Largest value; the caller rejects an empty list first."""
    return float(max(values))


#: Arithmetic the calculator understands, over the whole collected list.
AGGREGATES: dict[str, Callable[[Sequence[float]], float]] = {
    "sum": _agg_sum,
    "count": _agg_count,
    "mean": _agg_mean,
    "avg": _agg_mean,
    "min": _agg_min,
    "max": _agg_max,
}
#: Arithmetic over the first collected value and a configured operand.
BINARY: dict[str, Callable[[float, float], float]] = {
    "add": operator.add,
    "subtract": operator.sub,
    "multiply": operator.mul,
    "divide": operator.truediv,
}


class SimulatedToolbox:
    """A :class:`~app.engine.ports.ToolPort` over a fixed set of fake tools."""

    def __init__(self, fixtures: dict[str, Any] | None = None) -> None:
        self.fixtures: dict[str, Any] = dict(fixtures or {})
        self._tools: dict[str, ToolFn] = {
            "knowledge_search": self._knowledge_search,
            "ticket_lookup": self._ticket_lookup,
            "send_message": self._send_message,
            "web_fetch": self._web_fetch,
            "calculator": self._calculator,
        }

    # ------------------------------------------------------------------ port

    @property
    def tool_names(self) -> list[str]:
        """Every tool the canvas may offer in a Tool block's dropdown."""
        return sorted(self._tools)

    async def call(self, tool_name: str, config: dict[str, Any], data: Any) -> Any:
        """Dispatch to one named tool; unknown names raise :class:`ToolFailure`."""
        handler = self._tools.get(tool_name)
        if handler is None:
            raise ToolFailure(
                f"There is no tool called {tool_name!r}.",
                detail={"tool": tool_name, "available": self.tool_names},
            )
        config = dict(config or {})

        delay_ms = _int(config.get("simulate_delay_ms"), 0)
        if delay_ms > 0:
            await asyncio.sleep(delay_ms / 1000)
        error = config.get("simulate_error")
        if error:
            raise ToolFailure(
                str(error) if isinstance(error, str) else f"{tool_name} is unavailable.",
                detail={"tool": tool_name, "simulated": True},
            )
        return await handler(config, data)

    # ----------------------------------------------------------------- tools

    async def _knowledge_search(
        self, config: dict[str, Any], data: Any
    ) -> list[dict[str, Any]]:
        """Search a canned knowledge base; returns the documents for a query key."""
        query = _text(config, data, "query")
        if not query:
            return []
        fixtures = _section(self.fixtures, "knowledge_search")
        documents = fixtures.get("documents") or {}
        found = documents.get(_key(query))
        if found is None:
            found = fixtures.get("default")
        if found is None:
            found = _synth_documents(query)
        top_k = _int(config.get("top_k"), 0)
        results = [dict(item) for item in found]
        return results[:top_k] if top_k > 0 else results

    async def _ticket_lookup(
        self, config: dict[str, Any], data: Any
    ) -> dict[str, Any]:
        """Return metadata for a support ticket."""
        ticket_id = _text(config, data, "ticket_id") or _text(config, data, "id")
        if not ticket_id:
            raise ToolFailure(
                "ticket_lookup needs a ticket_id (config 'ticket_id' or 'ticket_id_field').",
                detail={"tool": "ticket_lookup"},
            )
        tickets = _section(self.fixtures, "ticket_lookup").get("tickets") or {}
        ticket = tickets.get(ticket_id) or tickets.get(_key(ticket_id))
        if ticket is not None:
            return {"ticket_id": ticket_id, **dict(ticket)}
        return _synth_ticket(ticket_id)

    async def _send_message(self, config: dict[str, Any], data: Any) -> dict[str, Any]:
        """Pretend to deliver a message and report exactly what would have gone out."""
        channel = str(config.get("channel") or "#general")
        message = _text(config, data, "message") or _stringify(data)
        preview = message if len(message) <= 280 else f"{message[:277]}..."
        return {
            "sent": True,
            "channel": channel,
            "to": config.get("to"),
            "preview": preview,
            "characters": len(message),
            "simulated": True,
        }

    async def _web_fetch(self, config: dict[str, Any], data: Any) -> dict[str, Any]:
        """Fetch a canned research source; different sources return different content."""
        source = _text(config, data, "source") or _text(config, data, "url")
        if not source:
            raise ToolFailure(
                "web_fetch needs a source (config 'source'/'url' or a *_field pointer).",
                detail={"tool": "web_fetch"},
            )
        sources = _section(self.fixtures, "web_fetch").get("sources") or {}
        page = sources.get(source) or sources.get(_key(source))
        if page is None:
            page = _synth_page(source)
        content = str(page.get("content", ""))
        return {
            "source": source,
            "url": page.get("url") or f"https://example.test/{_key(source).replace(' ', '-')}",
            "title": page.get("title") or source,
            "content": content,
            "words": len(content.split()),
        }

    async def _calculator(self, config: dict[str, Any], data: Any) -> dict[str, Any]:
        """Safe arithmetic over one numeric field (no expression evaluation)."""
        op = str(config.get("op") or "sum").lower()
        field_name = config.get("field")
        raw = config.get("values")
        if raw is None:
            if not field_name:
                raise ToolFailure(
                    "calculator needs a 'field' (or inline 'values').",
                    detail={"tool": "calculator", "op": op},
                )
            raw = get_path(data, str(field_name), MISSING)
            if raw is MISSING:
                raise ToolFailure(
                    f"calculator could not find the field {field_name!r} in the data.",
                    detail={"tool": "calculator", "field": field_name},
                )
        values = _numbers(raw, field_name)

        if op in BINARY:
            operand = _number(config.get("value"), "value")
            if op == "divide" and operand == 0:
                raise ToolFailure(
                    "calculator cannot divide by zero.",
                    detail={"tool": "calculator", "op": op},
                )
            result = BINARY[op](values[0] if values else 0.0, operand)
        elif op in AGGREGATES:
            if not values and op not in {"count", "sum"}:
                raise ToolFailure(
                    f"calculator cannot compute {op!r} of an empty list.",
                    detail={"tool": "calculator", "op": op, "field": field_name},
                )
            result = AGGREGATES[op](values)
        else:
            raise ToolFailure(
                f"calculator does not support the operation {op!r}.",
                detail={
                    "tool": "calculator",
                    "op": op,
                    "supported": sorted({*AGGREGATES, *BINARY}),
                },
            )

        precision = _int(config.get("round"), 4)
        return {
            "op": op,
            "field": field_name,
            "inputs": values,
            "value": round(float(result), precision),
        }


# --------------------------------------------------------------------- helpers


def _section(fixtures: dict[str, Any], name: str) -> dict[str, Any]:
    section = fixtures.get(name)
    return dict(section) if isinstance(section, dict) else {}


def _key(value: str) -> str:
    """Normalise a lookup key: lowercase, collapsed whitespace."""
    return " ".join(str(value).lower().split())


def _text(config: dict[str, Any], data: Any, name: str) -> str:
    """Read ``config[name]``, or follow ``config[name + "_field"]`` into the data."""
    value = config.get(name)
    if value is None:
        pointer = config.get(f"{name}_field")
        if pointer:
            value = get_path(data, str(pointer), None)
    if value is None:
        return ""
    return _stringify(value).strip()


def _stringify(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, sort_keys=True, default=str)


def _int(value: Any, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ToolFailure(
            f"calculator expected a number for {label!r}, got {value!r}.",
            detail={"tool": "calculator"},
        )
    return float(value)


def _numbers(raw: Any, field_name: Any) -> list[float]:
    items = raw if isinstance(raw, (list, tuple)) else [raw]
    return [_number(item, str(field_name or "value")) for item in items]


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _pick(options: tuple[str, ...], digest: str, offset: int) -> str:
    return options[int(digest[offset : offset + 4], 16) % len(options)]


def _synth_documents(query: str) -> list[dict[str, Any]]:
    """Two stable documents for a query nobody committed fixtures for.

    Built from the *normalised* key, so "SSO   Setup" and "sso setup" agree.
    """
    key = _key(query)
    digest = _digest(key)
    return [
        {
            "id": f"doc_{digest[index * 6 : index * 6 + 6]}",
            "title": f"{key.title()} - {label}",
            "snippet": (
                f"Simulated knowledge-base extract about {key!r} ({label.lower()})."
            ),
            "source": "simulated-knowledge-base",
            "score": round(0.9 - 0.15 * index, 2),
        }
        for index, label in enumerate(("Overview", "Details"))
    ]


def _synth_ticket(ticket_id: str) -> dict[str, Any]:
    digest = _digest(_key(ticket_id))
    return {
        "ticket_id": ticket_id,
        "subject": f"Customer issue {ticket_id}",
        "requester": f"user{digest[:4]}@example.test",
        "priority": _pick(PRIORITIES, digest, 4),
        "product_area": _pick(PRODUCT_AREAS, digest, 8),
        "status": _pick(TICKET_STATUSES, digest, 12),
        "simulated": True,
    }


def _synth_page(source: str) -> dict[str, Any]:
    digest = _digest(_key(source))
    return {
        "url": f"https://example.test/{_key(source).replace(' ', '-')}",
        "title": f"{source} - simulated research source",
        "content": (
            f"Simulated research notes from {source}. Reference {digest[:8]}. "
            "This content is generated deterministically so every run reads the same."
        ),
    }
