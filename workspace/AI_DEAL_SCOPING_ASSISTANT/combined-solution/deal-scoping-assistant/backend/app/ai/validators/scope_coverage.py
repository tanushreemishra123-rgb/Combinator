"""A functional scope must carry the reviewed requirements, not restate them away."""

from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, FindingLevel, error, warning
from app.domain.artifacts import FunctionalScope
from app.domain.scope import ItemType

# The requirement types every capability set must account for.
_COVERED_TYPES = {
    ItemType.FUNCTIONAL_REQUIREMENT,
    ItemType.NON_FUNCTIONAL_REQUIREMENT,
    ItemType.INTEGRATION,
    ItemType.DATA_REQUIREMENT,
    ItemType.SECURITY_COMPLIANCE,
}


def check_scope_coverage(
    content: FunctionalScope, items: Sequence[Any], level: FindingLevel = FindingLevel.ERROR
) -> list[Finding]:
    """Reject an empty scope; report requirements no capability includes."""
    if not content.capabilities:
        return [error("the functional scope has no capabilities; every requirement needs one")]
    covered = {req_id for cap in content.capabilities for req_id in cap.included_req_ids}
    missing = [item.id for item in items if item.type in _COVERED_TYPES and item.id not in covered]
    if not missing:
        return []
    make = error if level is FindingLevel.ERROR else warning
    return [make("these requirements are in no capability: " + ", ".join(missing), missing)]
