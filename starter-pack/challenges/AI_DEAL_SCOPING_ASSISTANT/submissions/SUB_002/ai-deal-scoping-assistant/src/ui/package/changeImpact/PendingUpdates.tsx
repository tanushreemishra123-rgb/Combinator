/**
 * "Pending updates" (spec 6: "regenerate or recalculate the affected sections without silently
 * replacing reviewed and unaffected content"). Lists every stale stage as a `StaleBanner` with its
 * reasons and the matching action, then shows every stage's status so it is visible that untouched
 * stages keep their reviewed content exactly as approved.
 */
import type { ReactElement } from 'react';
import type { PendingAction } from '../../../impact';
import type { StageStatusView } from '../../../state';
import { BusyOverlay, Card, EmptyState, StaleBanner, StatusPill } from '../../common';

export interface PendingUpdatesProps {
  pendingActions: PendingAction[];
  stageStatuses: StageStatusView[];
  /** Regenerates only the named stage - a row's own button never touches another stale stage. */
  onRegenerate: (stageId: PendingAction['stageId']) => void;
  busy: boolean;
}

function actionLabelFor(action: PendingAction): string {
  return action.action === 'recalculate' ? 'Recalculate estimate' : 'Regenerate affected sections';
}

function PendingRow({ action, onRegenerate }: { action: PendingAction; onRegenerate: (stageId: PendingAction['stageId']) => void }): ReactElement {
  return (
    <li className="pending-update-row">
      <p className="pending-update-label">{action.label}</p>
      <StaleBanner reasons={action.reasons} actionLabel={actionLabelFor(action)} onAction={() => onRegenerate(action.stageId)} />
    </li>
  );
}

function StageStatusSummary({ statuses }: { statuses: StageStatusView[] }): ReactElement {
  return (
    <ul className="stage-status-summary cluster">
      {statuses.map((stage) => (
        <li key={stage.stageId} className="stage-status-summary-item">
          <StatusPill status={stage.reviewed && stage.status === 'current' ? 'reviewed' : stage.status} dotOnly />
          <span className="text-sm">{stage.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function PendingUpdates({ pendingActions, stageStatuses, onRegenerate, busy }: PendingUpdatesProps): ReactElement {
  return (
    <Card
      title="Pending updates"
      subtitle="Reviewed sections that a change does not touch are preserved exactly as approved; only the stages below need attention."
    >
      {pendingActions.length === 0 ? (
        <EmptyState title="Nothing is out of date" message="Every generated section reflects the latest reviewed scope and configuration." />
      ) : (
        <BusyOverlay active={busy} label="Updating the affected sections...">
          <ul className="stack stack-sm pending-updates-list">
            {pendingActions.map((action) => (
              <PendingRow key={action.stageId} action={action} onRegenerate={onRegenerate} />
            ))}
          </ul>
        </BusyOverlay>
      )}
      <StageStatusSummary statuses={stageStatuses} />
    </Card>
  );
}
