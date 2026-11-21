"""Fixture-backed retrieval.

Responsibility: serve the Retrieval block committed documents, keyed by knowledge
base and query, with no network and no embedding model. Lives next to the
simulated tools because it is the same kind of thing: a fake external system that
always answers the same way.

Fixture shape (committed per puzzle in Task 4)::

    {
      "default_source": "support_handbook",
      "sources": {
        "support_handbook": {
          "documents": {
            "refund policy": [{"id", "title", "content", "source", "score"}],
            "*": [ ... ]            # optional catch-all for this source
          }
        }
      }
    }

A single-source puzzle may skip the nesting and commit ``{"documents": {...}}``.

**Empty retrieval without the injector**: a blank query - or a query key with no
committed documents and no ``"*"`` catch-all - returns ``[]``. That is the
natural path for "Ground the Knowledge Assistant", where an unanswerable question
must make the workflow refuse rather than hallucinate.
"""

from __future__ import annotations

from typing import Any

from app.blocks.base import get_path

CATCH_ALL = "*"


class FixtureRetrieval:
    """A :class:`~app.engine.ports.RetrievalPort` over committed documents."""

    def __init__(self, fixtures: dict[str, Any] | None = None) -> None:
        self.fixtures: dict[str, Any] = dict(fixtures or {})

    @property
    def sources(self) -> list[str]:
        """Knowledge bases this retrieval can serve."""
        declared = self.fixtures.get("sources")
        if isinstance(declared, dict):
            return sorted(declared)
        return []

    async def retrieve(
        self, query_config: dict[str, Any], data: Any
    ) -> list[dict[str, Any]]:
        """Return the documents committed for this ``(source, query)`` pair.

        ``query_config`` is the Retrieval block's config: ``query`` (or
        ``query_field`` pointing into the data), ``source`` and ``top_k``.
        """
        config = dict(query_config or {})
        query = _query(config, data)
        if not query:
            return []

        documents = self._documents_for(config.get("source"))
        found = documents.get(_key(query))
        if found is None:
            found = documents.get(CATCH_ALL)
        if not found:
            return []

        results = [dict(item) for item in found]
        top_k = _int(config.get("top_k"), 0)
        return results[:top_k] if top_k > 0 else results

    def _documents_for(self, source: Any) -> dict[str, Any]:
        """The ``{query key: documents}`` map for one knowledge base."""
        sources = self.fixtures.get("sources")
        if not isinstance(sources, dict):
            documents = self.fixtures.get("documents")
            return dict(documents) if isinstance(documents, dict) else {}
        name = source or self.fixtures.get("default_source")
        entry = sources.get(name) if name is not None else None
        if entry is None and len(sources) == 1 and source is None:
            entry = next(iter(sources.values()))
        if not isinstance(entry, dict):
            return {}
        documents = entry.get("documents")
        return dict(documents) if isinstance(documents, dict) else {}


def _query(config: dict[str, Any], data: Any) -> str:
    """Resolve the query: explicit config, a pointer into the data, or bare data."""
    value = config.get("query")
    if value in (None, ""):
        pointer = config.get("query_field")
        if pointer:
            value = get_path(data, str(pointer), None)
    if value in (None, "") and isinstance(data, str):
        value = data
    return str(value).strip() if value not in (None, "") else ""


def _key(value: str) -> str:
    return " ".join(str(value).lower().split())


def _int(value: Any, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
