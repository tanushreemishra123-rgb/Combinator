/**
 * "Quality gate" tab (spec 6, "Quality Gate"): the twelve pre-export checks, the quality summary
 * in the spec's format, and a notice when the last run no longer reflects the session.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ExportStatus, ScopingSession } from '../../../domain';
import { useActions } from '../../../state';
import { Button, Callout, Card, EmptyState, formatDateTime, formatNumber, MetricGrid, MetricTile } from '../../common';
import { isQualityReportOutdated } from '../qualityOutdated';
import { QualityCheckRow } from './QualityCheckRow';

export interface QualityTabProps {
  session: ScopingSession;
}

const EXPORT_STATUS_TONE: ReadonlyMap<ExportStatus, 'success' | 'warning' | 'danger'> = new Map([
  ['Ready', 'success'],
  ['Review Required', 'warning'],
  ['Blocked', 'danger'],
]);

function NoReportState({ onRun, busy }: { onRun: () => void; busy: boolean }): ReactElement {
  return (
    <EmptyState
      title="The quality gate has not been run yet"
      message="Run the pre-export quality check to see requirement coverage, unresolved questions and export readiness before you export the package."
      action={
        <Button onClick={onRun} busy={busy}>
          Run the pre-export quality check
        </Button>
      }
    />
  );
}

export function QualityTab({ session }: QualityTabProps): ReactElement {
  const actions = useActions();
  const [running, setRunning] = useState(false);

  function handleRun(): void {
    setRunning(true);
    try {
      actions.runQuality();
    } finally {
      setRunning(false);
    }
  }

  if (session.scope === null) {
    return <EmptyState title="Nothing to check yet" message="Analyze and approve the customer's requirements before running the pre-export quality check." />;
  }

  if (session.quality === null) {
    return <NoReportState onRun={handleRun} busy={running} />;
  }

  const { summary, checks } = session.quality;
  const outdated = isQualityReportOutdated(session);

  return (
    <div className="stack stack-lg">
      <div className="cluster quality-tab-header">
        <p className="text-sm text-muted">Last run {formatDateTime(session.quality.ranAt)}.</p>
        <Button variant="secondary" onClick={handleRun} busy={running}>
          Run the pre-export quality check
        </Button>
      </div>

      {outdated ? (
        <Callout tone="warning" title="This report is outdated">
          The reviewed scope or a generated section has changed since this quality gate ran. Run it again before relying on its findings for export.
        </Callout>
      ) : null}

      <MetricGrid>
        <MetricTile label="Requirement coverage" value={`${summary.requirementCoveragePct}%`} />
        <MetricTile label="Uncovered requirements" value={formatNumber(summary.uncoveredRequirements)} tone={summary.uncoveredRequirements > 0 ? 'warning' : 'success'} />
        <MetricTile label="Unresolved questions" value={formatNumber(summary.unresolvedQuestions)} tone={summary.unresolvedQuestions > 0 ? 'warning' : 'success'} />
        <MetricTile label="Unsupported recommendations" value={formatNumber(summary.unsupportedRecommendations)} tone={summary.unsupportedRecommendations > 0 ? 'warning' : 'success'} />
        <MetricTile label="Estimate confidence" value={summary.estimateConfidence} />
        <MetricTile label="Export status" value={summary.exportStatus} tone={EXPORT_STATUS_TONE.get(summary.exportStatus) ?? 'neutral'} />
      </MetricGrid>
      <MetricGrid>
        <MetricTile label="Estimation gaps" value={formatNumber(summary.estimationGaps)} />
        <MetricTile label="Cross-document inconsistencies" value={formatNumber(summary.inconsistencies)} />
        <MetricTile label="Items needing human validation" value={formatNumber(summary.humanValidationItems)} />
      </MetricGrid>

      <Card title="Quality checks" subtitle="Each check is deterministic and reproducible from the reviewed scope and generated deliverables.">
        <div className="stack stack-sm">
          {checks.map((check) => (
            <QualityCheckRow key={check.id} check={check} />
          ))}
        </div>
      </Card>
    </div>
  );
}
