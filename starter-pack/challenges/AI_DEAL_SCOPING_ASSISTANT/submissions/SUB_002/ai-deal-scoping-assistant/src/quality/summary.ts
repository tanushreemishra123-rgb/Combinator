/** Rolls the graded checks up into the quality summary shown before export. */
import type { CoverageReport, ExportStatus, QualityCheck, QualityCheckId, QualitySummary, ScopingSession } from '../domain';

/** Cross-document consistency checks whose issue counts add up to the summary's 'inconsistencies'. */
const CONSISTENCY_CHECK_IDS: readonly QualityCheckId[] = [
  'unjustified-components',
  'integrations-missing-from-plan',
  'ai-use-case-safeguards',
  'conflicting-cloud-selection',
  'estimate-consistency',
  'stale-sections',
];

function countOf(checks: readonly QualityCheck[], ids: readonly QualityCheckId[]): number {
  return checks.filter((check) => ids.includes(check.id)).reduce((total, check) => total + check.count, 0);
}

/** Blocked if any check fails, Review Required if any check warns, otherwise Ready. */
export function rollUpExportStatus(checks: readonly QualityCheck[]): ExportStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'Blocked';
  }
  return checks.some((check) => check.status === 'warn') ? 'Review Required' : 'Ready';
}

export function summarizeQuality(session: ScopingSession, coverage: CoverageReport, checks: readonly QualityCheck[]): QualitySummary {
  return {
    requirementCoveragePct: coverage.coveragePct,
    uncoveredRequirements: countOf(checks, ['uncovered-requirements']),
    unresolvedQuestions: countOf(checks, ['unresolved-questions']),
    unsupportedRecommendations: countOf(checks, ['unsupported-additions']),
    estimationGaps: countOf(checks, ['missing-estimation-inputs']),
    inconsistencies: countOf(checks, CONSISTENCY_CHECK_IDS),
    humanValidationItems: countOf(checks, ['assumptions-needing-validation']),
    estimateConfidence: session.outputs.estimate.data?.result.confidence ?? 'Not estimated',
    exportStatus: rollUpExportStatus(checks),
  };
}
