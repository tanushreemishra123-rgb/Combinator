"""Coverage matrix, coverage percentages and unsupported scope additions.

Rows are every non-rejected scope item so nothing is hidden; only approved
FR/NFR/INT/DATA/SEC items count towards the percentage (PLAN section 6).
"""

from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Any

from pydantic import Field

from app.domain.artifacts import ArtifactKind
from app.domain.base import DomainModel
from app.domain.scope import ConfirmationStatus, ItemStatus, ItemType, Priority, ScopeItem
from app.traceability.index import TraceIndex, build_index, iter_elements

# An item is "reviewed" once approved; a later edit only flips it to modified.
APPROVED_STATUSES = frozenset({ItemStatus.APPROVED, ItemStatus.MODIFIED})

# Types that carry the numeric coverage percentage.
COUNTED_TYPES = (
    ItemType.FUNCTIONAL_REQUIREMENT,
    ItemType.NON_FUNCTIONAL_REQUIREMENT,
    ItemType.INTEGRATION,
    ItemType.DATA_REQUIREMENT,
    ItemType.SECURITY_COMPLIANCE,
)

HIGH_PRIORITIES = (Priority.MUST, Priority.HIGH)

_ID_PREFIXES = tuple(f"{item_type.value}_" for item_type in ItemType)


class CoverageColumn(StrEnum):
    PRD = "prd"
    CAPABILITY = "capability"
    ARCHITECTURE = "architecture"
    DATA = "data"
    INTEGRATION = "integration"
    AI = "ai"
    WORKSTREAM = "workstream"


# Column -> (artifact kind, content path or None for the whole artifact).
COLUMN_SOURCES: dict[CoverageColumn, tuple[tuple[ArtifactKind, str | None], ...]] = {
    CoverageColumn.PRD: ((ArtifactKind.PRD, None),),
    CoverageColumn.CAPABILITY: ((ArtifactKind.FUNCTIONAL_SCOPE, "capabilities"),),
    CoverageColumn.ARCHITECTURE: ((ArtifactKind.ARCHITECTURE, None),),
    CoverageColumn.DATA: ((ArtifactKind.DATA_STRATEGY, None),),
    CoverageColumn.INTEGRATION: ((ArtifactKind.INTEGRATION_ARCHITECTURE, None),),
    CoverageColumn.AI: ((ArtifactKind.AI_STRATEGY, None),),
    CoverageColumn.WORKSTREAM: (
        (ArtifactKind.FUNCTIONAL_SCOPE, "workstreams"),
        (ArtifactKind.ESTIMATE_DRIVERS, None),
        (ArtifactKind.ESTIMATE, None),
    ),
}

# Elements that must be grounded in approved requirements (challenge: unsupported additions).
UNSUPPORTED_SOURCES: tuple[tuple[ArtifactKind, str, str], ...] = (
    (ArtifactKind.FUNCTIONAL_SCOPE, "capabilities", "capability"),
    (ArtifactKind.FUNCTIONAL_SCOPE, "recommended_enhancements", "recommended enhancement"),
    (ArtifactKind.ARCHITECTURE, "components", "architecture component"),
    (ArtifactKind.INTEGRATION_ARCHITECTURE, "integrations", "integration"),
    (ArtifactKind.AI_STRATEGY, "use_cases", "AI use case"),
)


class CoverageCell(DomainModel):
    column: CoverageColumn = Field(description="Matrix column.")
    element_ids: list[str] = Field(
        default_factory=list, description="Elements in that column referencing the item."
    )
    covered: bool = Field(description="True when at least one element references the item.")


class CoverageRow(DomainModel):
    item_id: str = Field(description="Scope item id.")
    item_type: ItemType = Field(description="Scope item type.")
    title: str = Field(description="Scope item title.")
    priority: Priority = Field(description="Review priority.")
    status: ItemStatus = Field(description="Review status.")
    counts_in_percentage: bool = Field(
        description="True for approved FR/NFR/INT/DATA/SEC rows, which carry the percentage."
    )
    covered: bool = Field(description="True when a capability covers this item.")
    cells: list[CoverageCell] = Field(default_factory=list, description="One cell per column.")


class UnsupportedAddition(DomainModel):
    artifact: ArtifactKind = Field(description="Artifact the element belongs to.")
    element_id: str = Field(description="Element id, e.g. CAP_07.")
    element_kind: str = Field(description="Plain name of the element kind.")
    referenced_ids: list[str] = Field(
        default_factory=list, description="Scope ids the element points at, if any."
    )
    reason: str = Field(description="Why the element counts as unsupported.")


class CoverageReport(DomainModel):
    rows: list[CoverageRow] = Field(default_factory=list, description="One row per scope item.")
    counted_count: int = Field(ge=0, description="Requirements counted in the percentage.")
    covered_count: int = Field(ge=0, description="Counted requirements covered by a capability.")
    coverage_pct: float = Field(ge=0, le=100, description="Coverage percentage.")
    uncovered_ids: list[str] = Field(
        default_factory=list, description="Counted requirements with no capability."
    )
    high_priority_count: int = Field(ge=0, description="Counted must/high requirements.")
    high_priority_covered_count: int = Field(ge=0, description="Covered must/high requirements.")
    high_priority_pct: float = Field(ge=0, le=100, description="Must/high coverage percentage.")
    high_priority_uncovered_ids: list[str] = Field(
        default_factory=list, description="Uncovered must/high requirements."
    )
    unsupported_additions: list[UnsupportedAddition] = Field(
        default_factory=list, description="Elements grounded in nothing approved."
    )


def is_scope_id(value: str) -> bool:
    """True when the string looks like a scope item id such as FR_01."""
    return value.startswith(_ID_PREFIXES)


def supporting_ids(items: Sequence[ScopeItem]) -> set[str]:
    """Ids that can justify generated content: approved and, for ASM, not rejected."""
    supported: set[str] = set()
    for item in items:
        if item.status not in APPROVED_STATUSES:
            continue
        assumption = item.details.assumption
        if assumption is not None and assumption.confirmation_status is ConfirmationStatus.REJECTED:
            continue
        supported.add(item.id)
    return supported


def counts_in_percentage(item: ScopeItem) -> bool:
    return item.type in COUNTED_TYPES and item.status in APPROVED_STATUSES


def _pct(covered: int, total: int) -> float:
    if total == 0:
        return 100.0
    return round(covered * 100 / total, 1)


def _cells(index: TraceIndex, item_id: str) -> list[CoverageCell]:
    refs = index.references(item_id)
    cells: list[CoverageCell] = []
    for column, sources in COLUMN_SOURCES.items():
        element_ids: dict[str, None] = {}
        for ref in refs:
            for kind, path in sources:
                if ref.artifact is kind and (path is None or ref.path == path):
                    element_ids.setdefault(ref.element_id, None)
        cells.append(
            CoverageCell(column=column, element_ids=sorted(element_ids), covered=bool(element_ids))
        )
    return cells


def _unsupported(
    contents: Mapping[ArtifactKind, Mapping[str, Any]],
    index: TraceIndex,
    items: Sequence[ScopeItem],
) -> list[UnsupportedAddition]:
    known = {item.id: item for item in items}
    supported = supporting_ids(items)
    findings: list[UnsupportedAddition] = []
    for kind, path, label in UNSUPPORTED_SOURCES:
        for element_id, _element in iter_elements(contents, kind, path):
            referenced = [ref for ref in index.referenced_ids(kind, element_id) if is_scope_id(ref)]
            if any(ref in supported for ref in referenced):
                continue
            rejected = [ref for ref in referenced if ref in known and ref not in supported]
            unknown = [ref for ref in referenced if ref not in known]
            if not referenced:
                reason = "references no requirement id"
            elif rejected and not unknown:
                reason = f"references only rejected or unconfirmed ids: {', '.join(rejected)}"
            elif unknown and not rejected:
                reason = f"references unknown ids: {', '.join(unknown)}"
            else:
                reason = (
                    "references only rejected or unknown ids: "
                    f"{', '.join(sorted(rejected + unknown))}"
                )
            findings.append(
                UnsupportedAddition(
                    artifact=kind,
                    element_id=element_id,
                    element_kind=label,
                    referenced_ids=referenced,
                    reason=reason,
                )
            )
    return findings


def build_coverage(
    items: Sequence[ScopeItem],
    contents: Mapping[ArtifactKind, Mapping[str, Any]],
    index: TraceIndex | None = None,
) -> CoverageReport:
    """Coverage matrix, percentages and unsupported additions for one session."""
    trace = index if index is not None else build_index(contents)
    rows: list[CoverageRow] = []
    counted = 0
    covered = 0
    uncovered: list[str] = []
    high_total = 0
    high_covered = 0
    high_uncovered: list[str] = []

    for item in items:
        if item.status is ItemStatus.REJECTED:
            continue
        cells = _cells(trace, item.id)
        by_column = {cell.column: cell for cell in cells}
        is_covered = by_column[CoverageColumn.CAPABILITY].covered
        in_pct = counts_in_percentage(item)
        rows.append(
            CoverageRow(
                item_id=item.id,
                item_type=item.type,
                title=item.title,
                priority=item.priority,
                status=item.status,
                counts_in_percentage=in_pct,
                covered=is_covered,
                cells=cells,
            )
        )
        if not in_pct:
            continue
        counted += 1
        if is_covered:
            covered += 1
        else:
            uncovered.append(item.id)
        if item.priority in HIGH_PRIORITIES:
            high_total += 1
            if is_covered:
                high_covered += 1
            else:
                high_uncovered.append(item.id)

    return CoverageReport(
        rows=rows,
        counted_count=counted,
        covered_count=covered,
        coverage_pct=_pct(covered, counted),
        uncovered_ids=uncovered,
        high_priority_count=high_total,
        high_priority_covered_count=high_covered,
        high_priority_pct=_pct(high_covered, high_total),
        high_priority_uncovered_ids=high_uncovered,
        unsupported_additions=_unsupported(contents, trace, items),
    )
