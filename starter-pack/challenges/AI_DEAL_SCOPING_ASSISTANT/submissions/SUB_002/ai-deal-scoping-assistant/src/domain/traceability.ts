/** Requirement-to-output traceability and coverage structures. */
import type { Priority } from './common';
import type { ScopeItemKind } from './scope';

export type TraceTargetType =
  | 'capability'
  | 'component'
  | 'dataDomain'
  | 'dataTopic'
  | 'integration'
  | 'aiUseCase'
  | 'framework'
  | 'workstream'
  | 'journey';

export interface TraceLink {
  requirementId: string;
  targetType: TraceTargetType;
  targetId: string;
  targetLabel: string;
}

export interface CoverageRow {
  requirementId: string;
  title: string;
  kind: ScopeItemKind;
  priority: Priority;
  capabilityIds: string[];
  componentIds: string[];
  strategyIds: string[];
  workstreamIds: string[];
  /** A requirement counts as covered when at least one capability or design element cites it. */
  covered: boolean;
}

/** A generated element that cites no reviewed requirement/assumption, or cites unknown IDs. */
export interface UnsupportedAddition {
  targetType: TraceTargetType;
  targetId: string;
  label: string;
  reason: string;
  unknownRefs: string[];
}

export interface CoverageReport {
  rows: CoverageRow[];
  links: TraceLink[];
  totalRequirements: number;
  coveredRequirements: number;
  coveragePct: number;
  highPriorityCoveragePct: number;
  uncoveredIds: string[];
  unsupportedAdditions: UnsupportedAddition[];
}
