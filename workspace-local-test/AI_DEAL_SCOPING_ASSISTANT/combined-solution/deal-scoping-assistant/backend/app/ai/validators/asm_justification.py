"""An architecture component may lean on an assumption only if that assumption holds up.

PLAN section 3: the ASM must not be rejected and must itself be traceable (linked to a
gap or question, carrying a source ref, or created by the reviewer). A pending ASM makes
the component require human validation.
"""

from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, error, warning
from app.ai.validators.common import item_key
from app.domain.scope import ConfirmationStatus, ItemStatus, ItemType, UpdatedBy


def _is_traceable(item: Any) -> bool:
    if item.source_refs:
        return True
    if any(ref.startswith(("GAP_", "Q_")) for ref in item.related_ids):
        return True
    return getattr(item, "updated_by", UpdatedBy.AI) is UpdatedBy.USER


def traceable_assumption_ids(items: Sequence[Any]) -> set[str]:
    """Assumption ids that may support a component."""
    usable: set[str] = set()
    for item in items:
        if item.type is not ItemType.ASSUMPTION:
            continue
        assumption = item.details.assumption
        rejected = getattr(item, "status", ItemStatus.PROPOSED) is ItemStatus.REJECTED or (
            assumption is not None and assumption.confirmation_status is ConfirmationStatus.REJECTED
        )
        if not rejected and _is_traceable(item):
            usable.add(item_key(item))
    return usable


def _pending_assumption_ids(items: Sequence[Any]) -> set[str]:
    return {
        item_key(item)
        for item in items
        if item.type is ItemType.ASSUMPTION
        and item.details.assumption is not None
        and item.details.assumption.confirmation_status is ConfirmationStatus.PENDING
    }


def check_asm_justification(architecture: Any, items: Sequence[Any]) -> list[Finding]:
    known = {item_key(item) for item in items if item.type is ItemType.ASSUMPTION}
    usable = traceable_assumption_ids(items)
    pending = _pending_assumption_ids(items)
    findings: list[Finding] = []
    for component in architecture.components:
        for ref in component.supported_ids:
            if not ref.startswith("ASM_") or ref not in known:
                continue  # unknown ids are reported by the id-reference validator
            if ref not in usable:
                findings.append(
                    error(
                        f"{component.id} is justified by {ref}, which is rejected or not "
                        "traceable; support the component with a requirement instead",
                        [component.id, ref],
                    )
                )
            elif ref in pending and not component.validation_required:
                findings.append(
                    warning(
                        f"{component.id} relies on the pending assumption {ref}, "
                        "so it needs human validation",
                        [component.id, ref],
                    )
                )
    return findings
