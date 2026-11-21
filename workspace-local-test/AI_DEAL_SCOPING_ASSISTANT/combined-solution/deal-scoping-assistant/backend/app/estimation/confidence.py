"""Confidence from the inputs alone, computed before any range is applied.

Four signals per workstream: how much of it rests on assumed or inferred
requirements, open questions, pending assumptions, and missing information that
touches it. The worst signal wins and every signal that fired is written out in
plain language.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.artifacts import DriverWorkstream
from app.domain.estimation import (
    ConfidenceLevel,
    ConfidenceSignal,
    ConfidenceThreshold,
    EstimationRules,
)
from app.domain.scope import (
    AnswerStatus,
    ConfirmationStatus,
    GapCriticality,
    ItemType,
    NfrCategory,
    Origin,
    ScopeItem,
)
from app.estimation.config import EstimationRulesInvalid

# Worst first, so `min` over indexes gives the worst level.
_ORDER = (ConfidenceLevel.LOW, ConfidenceLevel.MEDIUM, ConfidenceLevel.HIGH)
_SIZING_CATEGORIES = (NfrCategory.SCALABILITY, NfrCategory.PERFORMANCE)


@dataclass
class Assessment:
    """A confidence level and why it is not higher."""

    level: ConfidenceLevel
    limitations: list[str] = field(default_factory=list)


def worst(levels: Iterable[ConfidenceLevel]) -> ConfidenceLevel:
    return min(levels, key=_ORDER.index, default=ConfidenceLevel.HIGH)


def reduce_one_step(level: ConfidenceLevel) -> ConfidenceLevel:
    index = _ORDER.index(level)
    return _ORDER[max(index - 1, 0)]


def _threshold(rules: EstimationRules, signal: ConfidenceSignal) -> ConfidenceThreshold:
    found = rules.threshold_for(signal)
    if found is None:  # the loader checks this; a missing row must not become a guess.
        raise EstimationRulesInvalid(f"no confidence threshold for {signal.value}")
    return found


def _level_from(count: float, threshold: ConfidenceThreshold) -> ConfidenceLevel:
    if count >= threshold.low_at:
        return ConfidenceLevel.LOW
    if count >= threshold.medium_at:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.HIGH


class ScopeIndex:
    """Read-only view of the scope items the confidence rules need."""

    def __init__(self, items: Sequence[ScopeItem]) -> None:
        self.by_id = {item.id: item for item in items}
        self.items = list(items)

    def _linked(self, item: ScopeItem, req_ids: set[str]) -> bool:
        """An item touches a workstream when either side points at the other."""
        if item.id in req_ids:
            return True
        if req_ids & set(item.related_ids):
            return True
        question = item.details.question
        if question and req_ids & set(question.affected_ids):
            return True
        return any(item.id in self.by_id[rid].related_ids for rid in req_ids if rid in self.by_id)

    def open_questions(self, req_ids: set[str]) -> list[ScopeItem]:
        return [
            item
            for item in self.items
            if item.type is ItemType.CLARIFICATION_QUESTION
            and item.details.question is not None
            and item.details.question.answer_status is AnswerStatus.OPEN
            and self._linked(item, req_ids)
        ]

    def pending_assumptions(self, req_ids: set[str]) -> list[ScopeItem]:
        return [
            item
            for item in self.items
            if item.type is ItemType.ASSUMPTION
            and item.details.assumption is not None
            and item.details.assumption.confirmation_status is ConfirmationStatus.PENDING
            and self._linked(item, req_ids)
        ]

    def gaps(self, req_ids: set[str], workstream_labels: set[str]) -> list[ScopeItem]:
        found = []
        for item in self.items:
            if item.type is not ItemType.MISSING_INFORMATION or item.details.gap is None:
                continue
            areas = {area.lower() for area in item.details.gap.impacted_areas}
            touches_area = any(
                label and any(label in area or area in label for area in areas)
                for label in workstream_labels
            )
            if touches_area or self._linked(item, req_ids):
                found.append(item)
        return found

    def has_sizing_nfr(self) -> bool:
        """True when some NFR needs a user volume to be sized."""
        return any(
            item.type is ItemType.NON_FUNCTIONAL_REQUIREMENT
            and item.details.nfr is not None
            and item.details.nfr.category in _SIZING_CATEGORIES
            for item in self.items
        )

    def sizing_req_ids(self) -> set[str]:
        return {
            item.id
            for item in self.items
            if item.type is ItemType.NON_FUNCTIONAL_REQUIREMENT
            and item.details.nfr is not None
            and item.details.nfr.category in _SIZING_CATEGORIES
        }


def assess_workstream(
    workstream: DriverWorkstream,
    index: ScopeIndex,
    rules: EstimationRules,
    extra_limitations: Sequence[str] = (),
) -> Assessment:
    """Confidence for one workstream, from its inputs only."""
    req_ids = set(workstream.req_ids)
    limitations: list[str] = []
    levels: list[ConfidenceLevel] = [ConfidenceLevel.HIGH]

    unknown = sorted(rid for rid in req_ids if rid not in index.by_id)
    soft = [
        rid
        for rid in req_ids
        if rid in index.by_id and index.by_id[rid].origin in (Origin.AI_INFERRED, Origin.ASSUMED)
    ]
    counted = len(soft) + len(unknown)
    share = Decimal(counted) / Decimal(len(req_ids)) if req_ids else Decimal(0)
    levels.append(_level_from(float(share), _threshold(rules, ConfidenceSignal.ASSUMED_SHARE)))
    if counted:
        limitations.append(
            f"{counted} of {len(req_ids)} requirements here are inferred or assumed, "
            f"not stated by the customer ({share * 100:.0f}%)."
        )
    if unknown:
        limitations.append(
            "Requirements not found in the reviewed scope: " + ", ".join(unknown) + "."
        )
    if not req_ids:
        levels.append(ConfidenceLevel.MEDIUM)
        limitations.append("No requirements are linked to this workstream.")

    questions = index.open_questions(req_ids)
    levels.append(_level_from(len(questions), _threshold(rules, ConfidenceSignal.OPEN_QUESTIONS)))
    if questions:
        limitations.append(
            "Clarification questions still open: " + ", ".join(q.id for q in questions) + "."
        )

    assumptions = index.pending_assumptions(req_ids)
    pending = _threshold(rules, ConfidenceSignal.PENDING_ASSUMPTIONS)
    levels.append(_level_from(len(assumptions), pending))
    if assumptions:
        limitations.append(
            "Assumptions not confirmed by the customer: "
            + ", ".join(a.id for a in assumptions)
            + "."
        )

    labels = {workstream.id.lower(), workstream.name.lower()}
    gaps = index.gaps(req_ids, labels)
    levels.append(_level_from(len(gaps), _threshold(rules, ConfidenceSignal.MISSING_INFORMATION)))
    critical = [
        g for g in gaps if g.details.gap and g.details.gap.criticality is GapCriticality.HIGH
    ]
    if rules.low_when_gap_is_critical and critical:
        levels.append(ConfidenceLevel.LOW)
    if gaps:
        limitations.append("Information still missing: " + ", ".join(g.id for g in gaps) + ".")

    limitations.extend(extra_limitations)
    if extra_limitations:
        levels.append(ConfidenceLevel.MEDIUM)

    return Assessment(level=worst(levels), limitations=limitations)


def assess_overall(
    workstream_levels: Sequence[ConfidenceLevel],
    session_issues: Sequence[str],
) -> Assessment:
    """Lowest workstream confidence, one step lower per session-level issue."""
    level = worst(workstream_levels)
    for _ in session_issues:
        level = reduce_one_step(level)
    return Assessment(level=level, limitations=list(session_issues))
