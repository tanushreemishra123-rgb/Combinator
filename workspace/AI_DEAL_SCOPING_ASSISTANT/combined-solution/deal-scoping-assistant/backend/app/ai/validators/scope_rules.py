"""Grounding rules for the scope model (PLAN section 2 "Rules")."""

from collections.abc import Sequence
from typing import Any

from app.ai.findings import Finding, error, warning
from app.ai.validators.common import item_key
from app.domain.scope import GapCriticality, ItemType, Origin

_NEEDS_SOURCE = (Origin.CUSTOMER_STATED, Origin.AI_INFERRED)
_ABSENCE_TYPES = (ItemType.MISSING_INFORMATION, ItemType.CLARIFICATION_QUESTION)
# Mirrors the domain rule, so a missing detail block is repaired instead of crashing.
_DETAILS_BY_TYPE = {
    ItemType.NON_FUNCTIONAL_REQUIREMENT: "nfr",
    ItemType.INTEGRATION: "integration",
    ItemType.MISSING_INFORMATION: "gap",
    ItemType.ASSUMPTION: "assumption",
    ItemType.CLARIFICATION_QUESTION: "question",
}


def _links(item: Any) -> list[str]:
    """Ids this item points at: related ids plus the gap's question and assumption."""
    links = list(item.related_ids)
    gap = item.details.gap
    if gap is not None:
        links.extend(ref for ref in (gap.question_id, gap.assumption_id) if ref)
    return links


def _links_to(
    item: Any,
    types: tuple[ItemType, ...],
    type_by_key: dict[str, ItemType],
    linked_from: dict[str, list[str]],
) -> bool:
    prefixes = tuple(f"{item_type.value}_" for item_type in types)
    if any(type_by_key.get(link) in types or link.startswith(prefixes) for link in _links(item)):
        return True
    # A question or assumption a gap points at is linked, even without the reverse reference.
    sources = linked_from.get(item_key(item), [])
    return any(
        type_by_key.get(source) in types or source.startswith(prefixes) for source in sources
    )


def _incoming_gap_links(items: Sequence[Any]) -> dict[str, list[str]]:
    incoming: dict[str, list[str]] = {}
    for item in items:
        gap = item.details.gap
        if gap is None:
            continue
        for target in (gap.question_id, gap.assumption_id):
            if target:
                incoming.setdefault(target, []).append(item_key(item))
    return incoming


def check_scope_rules(items: Sequence[Any]) -> list[Finding]:
    """Source grounding, critical gaps linked to a question or assumption, traceable assumptions."""
    type_by_key = {item_key(item): item.type for item in items}
    linked_from = _incoming_gap_links(items)
    findings: list[Finding] = []
    for item in items:
        key = item_key(item)
        if item.origin in _NEEDS_SOURCE and not item.source_refs:
            findings.append(
                error(f"{key} is {item.origin} so it needs at least one source reference", [key])
            )
        if (
            item.origin is Origin.CUSTOMER_STATED
            and item.source_refs
            and not any(ref.verified for ref in item.source_refs)
        ):
            findings.append(
                warning(f"{key} is customer_stated but no quote could be verified", [key])
            )
        if item.type in _ABSENCE_TYPES and not item.source_refs and not item.absence_note.strip():
            findings.append(
                error(f"{key} has no source reference, so it needs an absence_note", [key])
            )
        expected = _DETAILS_BY_TYPE.get(item.type)
        if expected and getattr(item.details, expected) is None:
            findings.append(
                error(f"{key} is a {item.type} item, so details.{expected} must be filled", [key])
            )
        gap = item.details.gap
        if (
            item.type is ItemType.MISSING_INFORMATION
            and gap is not None
            and gap.criticality is GapCriticality.HIGH
            and not _links_to(
                item,
                (ItemType.CLARIFICATION_QUESTION, ItemType.ASSUMPTION),
                type_by_key,
                linked_from,
            )
        ):
            findings.append(
                error(
                    f"{key} is a high-criticality gap, so it must link to a clarification "
                    "question or an assumption",
                    [key],
                )
            )
        if item.origin is Origin.ASSUMED and not _links_to(
            item,
            (ItemType.MISSING_INFORMATION, ItemType.CLARIFICATION_QUESTION),
            type_by_key,
            linked_from,
        ):
            findings.append(
                error(
                    f"{key} is assumed, so it must link to a gap or a clarification question",
                    [key],
                )
            )
    return findings
