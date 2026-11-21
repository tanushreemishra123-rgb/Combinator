"""Section outline of the exported package, read from the shared seed file.

The seed is the single source of the section order, so the builder and the
frontend cannot drift apart.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.package.errors import OutlineError

# app/package/outline.py -> app/package -> app -> backend
OUTLINE_PATH = Path(__file__).resolve().parents[2] / "seeds" / "documents" / "package_outline.json"


@dataclass(frozen=True)
class OutlineSection:
    id: str
    title: str
    source: str


@lru_cache(maxsize=1)
def load_outline(path: Path = OUTLINE_PATH) -> tuple[OutlineSection, ...]:
    """Ordered sections of the package. Cached: the seed does not change at runtime."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise OutlineError(f"package outline not found at {path}") from exc
    except json.JSONDecodeError as exc:
        raise OutlineError(f"package outline at {path} is not valid JSON: {exc}") from exc

    sections = raw.get("sections")
    if not isinstance(sections, list) or not sections:
        raise OutlineError(f"package outline at {path} has no sections")

    out: list[OutlineSection] = []
    for entry in sections:
        try:
            out.append(
                OutlineSection(id=entry["id"], title=entry["title"], source=entry.get("source", ""))
            )
        except (TypeError, KeyError) as exc:
            raise OutlineError(f"package outline entry is missing id or title: {entry!r}") from exc
    return tuple(out)
