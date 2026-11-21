"""Every generated element must say which requirement it rests on."""

from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, FindingLevel, error, warning


def check_grounding(
    labelled: Sequence[tuple[str, Any]], level: FindingLevel = FindingLevel.ERROR
) -> list[Finding]:
    """Report elements whose `req_ids` is empty; `labelled` pairs a name with each element."""
    missing = [name for name, element in labelled if not getattr(element, "req_ids", None)]
    if not missing:
        return []
    make = error if level is FindingLevel.ERROR else warning
    return [
        make(
            "these elements name no requirement id: " + ", ".join(missing),
            [name for name in missing if "_" in name and name.split("_")[-1].isdigit()],
        )
    ]
