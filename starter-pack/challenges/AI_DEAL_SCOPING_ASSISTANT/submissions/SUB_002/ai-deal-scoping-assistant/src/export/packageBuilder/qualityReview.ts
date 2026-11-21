/** "Quality review" package section (spec 6, "Quality Gate"): the quality summary and every check's findings. */
import type { PackageSection, QualityCheck, QualityFinding, ScopingSession } from '../../domain';
import { joinOrFallback, refsCell, tableOrParagraph } from '../text';

const STATUS_TEXT: ReadonlyMap<QualityCheck['status'], string> = new Map([
  ['pass', 'Pass'],
  ['warn', 'Warning'],
  ['fail', 'Fail'],
]);

function findingText(findings: readonly QualityFinding[]): string {
  return joinOrFallback(
    findings.map((finding) => `${finding.message} (${refsCell(finding.refs)})`),
    'No findings.',
  );
}

function checkRow(check: QualityCheck): string[] {
  return [check.label, STATUS_TEXT.get(check.status) ?? check.status, String(check.count), findingText(check.findings)];
}

export function buildQualityReviewSection(session: ScopingSession): PackageSection {
  const quality = session.quality;
  if (quality === null) {
    return {
      id: 'quality-review',
      title: 'Quality review',
      blocks: [{ type: 'callout', tone: 'warning', title: 'Quality gate has not been run', text: 'Run the quality gate before export so uncovered requirements, unresolved questions and unsupported recommendations are surfaced.' }],
    };
  }
  const { summary } = quality;
  return {
    id: 'quality-review',
    title: 'Quality review',
    blocks: [
      {
        type: 'keyValues',
        pairs: [
          { key: 'Requirement coverage', value: `${summary.requirementCoveragePct}%` },
          { key: 'Uncovered requirements', value: String(summary.uncoveredRequirements) },
          { key: 'Unresolved questions', value: String(summary.unresolvedQuestions) },
          { key: 'Unsupported recommendations', value: String(summary.unsupportedRecommendations) },
          { key: 'Estimation gaps', value: String(summary.estimationGaps) },
          { key: 'Inconsistencies', value: String(summary.inconsistencies) },
          { key: 'Items needing human validation', value: String(summary.humanValidationItems) },
          { key: 'Estimate confidence', value: summary.estimateConfidence },
          { key: 'Export status', value: summary.exportStatus },
        ],
      },
      tableOrParagraph(['Check', 'Status', 'Count', 'Findings'], quality.checks.map(checkRow), 'No quality checks were run.'),
    ],
  };
}
