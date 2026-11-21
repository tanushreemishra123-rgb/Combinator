/** Pre-export quality gate structures. */
import type { Confidence } from './common';

export const QUALITY_CHECK_IDS = [
  'high-priority-coverage',
  'uncovered-requirements',
  'unsupported-additions',
  'unjustified-components',
  'integrations-missing-from-plan',
  'ai-use-case-safeguards',
  'missing-estimation-inputs',
  'unresolved-questions',
  'conflicting-cloud-selection',
  'estimate-consistency',
  'assumptions-needing-validation',
  'stale-sections',
] as const;
export type QualityCheckId = (typeof QUALITY_CHECK_IDS)[number];

export interface QualityFinding {
  message: string;
  refs: string[];
}

export interface QualityCheck {
  id: QualityCheckId;
  label: string;
  description: string;
  status: 'pass' | 'warn' | 'fail';
  count: number;
  findings: QualityFinding[];
}

export type ExportStatus = 'Ready' | 'Review Required' | 'Blocked';

export interface QualitySummary {
  requirementCoveragePct: number;
  uncoveredRequirements: number;
  unresolvedQuestions: number;
  unsupportedRecommendations: number;
  estimationGaps: number;
  inconsistencies: number;
  humanValidationItems: number;
  estimateConfidence: Confidence | 'Not estimated';
  exportStatus: ExportStatus;
}

export interface QualityReport {
  checks: QualityCheck[];
  summary: QualitySummary;
  ranAt: string;
  scopeVersion: number;
}
