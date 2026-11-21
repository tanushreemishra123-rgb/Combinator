/**
 * Estimate Workspace header (spec "Estimate Workspace"): the "Estimate the delivery" generate
 * action gated on the upstream-deliverable prerequisite, the generation audit line, the numbers'
 * own last-calculated timestamp (which can be newer than the generation meta after a pure
 * recalculation), a reviewed toggle, and a stale banner offering recalculate or regenerate.
 */
import type { ReactElement } from 'react';
import type { PendingAction } from '../../../impact';
import { Button, Callout, formatDateTime, GenerationMetaLine, SectionHeader, SparklesIcon, StaleBanner, StatusPill, Toggle } from '../../common';
import { staleActionLabel } from '../estimateView';
import type { EstimateHeaderView } from '../estimateView';

export interface EstimateHeaderProps {
  view: EstimateHeaderView;
  pendingAction: PendingAction | null;
  /** ISO timestamp the current numbers were computed at, or null before anything is generated. */
  computedAt: string | null;
  onGenerate: () => void;
  onStaleAction: () => void;
  onToggleReviewed: (reviewed: boolean) => void;
}

export function EstimateHeader({ view, pendingAction, computedAt, onGenerate, onStaleAction, onToggleReviewed }: EstimateHeaderProps): ReactElement {
  const actionLabel = view.hasData ? 'Regenerate the estimate' : 'Estimate the delivery';

  return (
    <header className="estimate-header stack stack-md">
      <SectionHeader
        eyebrow="Estimate the delivery"
        title="Effort, timeline and ROM commercials"
        description="Every number below is reproducible from the estimation inputs, the rate card and the documented calculation rules - never an unsupported AI figure."
        actions={<StatusPill status={view.pillStatus} />}
      />
      <div className="cluster">
        <Button variant="primary" icon={<SparklesIcon />} busy={view.isBusy} disabled={!view.canGenerate} onClick={onGenerate}>
          {actionLabel}
        </Button>
        {view.hasData ? <Toggle checked={view.reviewed} onChange={onToggleReviewed} label="Mark as reviewed" disabled={view.isBusy} /> : null}
      </div>
      {view.prerequisite !== null ? <Callout tone="info">{view.prerequisite}</Callout> : null}
      {view.meta !== null ? <GenerationMetaLine meta={view.meta} /> : null}
      {computedAt !== null ? <p className="text-subtle text-xs">Numbers last calculated {formatDateTime(computedAt)}.</p> : null}
      {view.status === 'stale' ? (
        <StaleBanner reasons={view.staleReasons} actionLabel={staleActionLabel(pendingAction)} onAction={onStaleAction} />
      ) : null}
    </header>
  );
}
