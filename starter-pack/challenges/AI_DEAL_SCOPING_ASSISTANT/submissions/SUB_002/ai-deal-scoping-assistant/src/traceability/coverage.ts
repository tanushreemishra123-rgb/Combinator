/**
 * Requirement coverage (spec section 2: "a coverage view showing which requirements are covered
 * by each capability or workstream") and unsupported-addition detection (spec: "identify uncovered
 * requirements and unsupported scope additions without requiring the reviewer to manually compare
 * the complete documents").
 */
import { compareScopeItems, getRequirements, knownIds } from '../scope';
import type { CoverageReport, CoverageRow, ScopeItem, ScopingSession, TraceLink, TraceTargetType, UnsupportedAddition } from '../domain';
import type { TraceableElement } from './elements';
import { collectElements, elementsToLinks } from './elements';
import { targetTypeNoun } from './labels';

interface RowRefs {
  capabilityIds: string[];
  componentIds: string[];
  strategyIds: string[];
  workstreamIds: string[];
}

function emptyRowRefs(): RowRefs {
  return { capabilityIds: [], componentIds: [], strategyIds: [], workstreamIds: [] };
}

function addTargetId(refs: RowRefs, targetType: TraceTargetType, targetId: string): void {
  const bucket = pickBucket(refs, targetType);
  if (bucket !== null && !bucket.includes(targetId)) {
    bucket.push(targetId);
  }
}

/** Picks the row bucket a target type contributes to; `null` for target types not tracked on a row (e.g. journeys). */
function pickBucket(refs: RowRefs, targetType: TraceTargetType): string[] | null {
  switch (targetType) {
    case 'capability':
      return refs.capabilityIds;
    case 'component':
      return refs.componentIds;
    case 'workstream':
      return refs.workstreamIds;
    case 'dataDomain':
    case 'dataTopic':
    case 'integration':
    case 'aiUseCase':
    case 'framework':
      return refs.strategyIds;
    case 'journey':
      return null;
  }
}

/** Data-strategy topics have no structured id of their own, so the matrix shows their readable label instead of the internal topic key. */
function matrixRef(link: TraceLink): string {
  return link.targetType === 'dataTopic' ? link.targetLabel : link.targetId;
}

/** Groups trace links by the requirement id they cite, bucketed by which kind of output cited them. */
function groupByRequirement(links: readonly TraceLink[]): Map<string, RowRefs> {
  const byRequirement = new Map<string, RowRefs>();
  for (const link of links) {
    const refs = byRequirement.get(link.requirementId) ?? emptyRowRefs();
    addTargetId(refs, link.targetType, matrixRef(link));
    byRequirement.set(link.requirementId, refs);
  }
  return byRequirement;
}

function buildRow(requirement: ScopeItem, refs: RowRefs | undefined): CoverageRow {
  const rowRefs = refs ?? emptyRowRefs();
  return {
    requirementId: requirement.id,
    title: requirement.title,
    kind: requirement.kind,
    priority: requirement.priority,
    capabilityIds: rowRefs.capabilityIds,
    componentIds: rowRefs.componentIds,
    strategyIds: rowRefs.strategyIds,
    workstreamIds: rowRefs.workstreamIds,
    // Workstreams describe delivery, not solution coverage, so they intentionally don't count here.
    covered: rowRefs.capabilityIds.length > 0 || rowRefs.componentIds.length > 0 || rowRefs.strategyIds.length > 0,
  };
}

/**
 * `covered / total` as a whole-number percentage. Zero requirements is reported as 0%, not 100%:
 * treating "nothing to cover" as full coverage would misleadingly suggest the solution is complete
 * before any requirement has even been approved.
 */
function coveragePercent(covered: number, total: number): number {
  return total === 0 ? 0 : Math.round((covered / total) * 100);
}

function describeElement(item: TraceableElement): string {
  const noun = item.contentLabel === 'recommended-enhancement' ? 'Recommended enhancement' : targetTypeNoun(item.targetType);
  return `${noun} "${item.targetLabel}" (${item.targetId})`;
}

/**
 * Flags a generated element as unsupported when it cites nothing, or cites a ref outside the
 * approved scope model. A `recommended-enhancement` capability with valid refs is not flagged
 * merely for being an enhancement - only these two ref-based checks apply, uniformly.
 */
function evaluateElement(item: TraceableElement, known: ReadonlySet<string>): UnsupportedAddition | null {
  if (item.refs.length === 0) {
    return {
      targetType: item.targetType,
      targetId: item.targetId,
      label: item.targetLabel,
      reason: `${describeElement(item)} cites no reviewed requirement or assumption and needs a traceability reference before it can be trusted.`,
      unknownRefs: [],
    };
  }
  const unknownRefs = item.refs.filter((ref) => !known.has(ref));
  if (unknownRefs.length === 0) {
    return null;
  }
  const plural = unknownRefs.length === 1 ? 'an id' : 'ids';
  return {
    targetType: item.targetType,
    targetId: item.targetId,
    label: item.targetLabel,
    reason: `${describeElement(item)} cites ${plural} not present in the approved scope model: ${unknownRefs.join(', ')}.`,
    unknownRefs,
  };
}

function emptyCoverageReport(): CoverageReport {
  return { rows: [], links: [], totalRequirements: 0, coveredRequirements: 0, coveragePct: 0, highPriorityCoveragePct: 0, uncoveredIds: [], unsupportedAdditions: [] };
}

/**
 * Cross-document coverage and consistency validation (Solution Depth Requirement): for every
 * reviewed requirement, which capabilities, architecture components and strategy elements cite it,
 * and which generated elements cite nothing or cite an id outside the approved scope. Returns an
 * empty report when the session has no scope model yet - there is nothing to validate coverage
 * against before analysis has produced one.
 */
export function buildCoverageReport(session: ScopingSession): CoverageReport {
  const scope = session.scope;
  if (scope === null) {
    return emptyCoverageReport();
  }

  const elements = collectElements(session);
  const links = elementsToLinks(elements);
  const byRequirement = groupByRequirement(links);
  const requirements = [...getRequirements(scope)].sort(compareScopeItems);
  const rows = requirements.map((requirement) => buildRow(requirement, byRequirement.get(requirement.id)));

  const coveredRows = rows.filter((row) => row.covered);
  const highPriorityRows = rows.filter((row) => row.priority === 'High');
  const coveredHighPriorityRows = highPriorityRows.filter((row) => row.covered);
  const known = knownIds(scope);

  return {
    rows,
    links,
    totalRequirements: rows.length,
    coveredRequirements: coveredRows.length,
    coveragePct: coveragePercent(coveredRows.length, rows.length),
    highPriorityCoveragePct: coveragePercent(coveredHighPriorityRows.length, highPriorityRows.length),
    uncoveredIds: rows.filter((row) => !row.covered).map((row) => row.requirementId),
    unsupportedAdditions: elements.map((item) => evaluateElement(item, known)).filter((addition): addition is UnsupportedAddition => addition !== null),
  };
}
