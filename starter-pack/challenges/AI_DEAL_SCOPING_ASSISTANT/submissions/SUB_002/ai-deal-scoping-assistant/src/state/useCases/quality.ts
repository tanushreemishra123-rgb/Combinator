/**
 * Quality Gate use case (spec section 6): runs the twelve deterministic pre-export checks on the
 * active session, stores the report and tells the reviewer the resulting Export Status.
 */
import type { ExportStatus, QualityReport } from '../../domain';
import { runQualityGate } from '../../quality';
import type { NoticeTone, UseCaseDeps } from '../types';
import { notify, requireActiveSession, runGuarded, saveSession } from './support';

const STATUS_TONES: ReadonlyMap<ExportStatus, NoticeTone> = new Map([
  ['Ready', 'success'],
  ['Review Required', 'warning'],
  ['Blocked', 'error'],
]);

function countByStatus(report: QualityReport, status: 'warn' | 'fail'): number {
  return report.checks.filter((check) => check.status === status).length;
}

/** 'Export status: Review Required - 0 checks failed, 3 need review, requirement coverage 92%.' */
export function describeQualityReport(report: QualityReport): string {
  const { exportStatus, requirementCoveragePct } = report.summary;
  const failed = countByStatus(report, 'fail');
  const warned = countByStatus(report, 'warn');
  return `Export status: ${exportStatus} - ${failed} check(s) failed, ${warned} need review, requirement coverage ${Math.round(requirementCoveragePct)}%.`;
}

/** Runs the quality gate on the active session, saves the report and announces the export status. */
export function runQuality(deps: UseCaseDeps): void {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  runGuarded(deps, 'Quality gate could not be run', undefined, () => {
    const quality = runQualityGate(session, deps.now());
    saveSession(deps, { ...session, quality });
    notify(deps, STATUS_TONES.get(quality.summary.exportStatus) ?? 'info', 'Quality gate completed', describeQualityReport(quality));
  });
}
