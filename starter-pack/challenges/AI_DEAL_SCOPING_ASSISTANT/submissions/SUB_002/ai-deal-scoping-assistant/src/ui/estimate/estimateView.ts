/**
 * Pure view-model for the estimate stage's header (gating, status pill) and the stale-banner
 * action (recalculate vs regenerate). Kept outside any component so the rule "which action the
 * reviewer is offered" is unit-testable without React, matching the pattern the other generation
 * workspaces use for their own stage status rows.
 */
import type { PendingAction } from '../../impact';
import type { GenerationMeta, SectionState, SectionStatus } from '../../domain';
import type { BusyState, StageId } from '../../state';
import type { StatusPillStatus } from '../common';

const ESTIMATE_STAGE_ID: StageId = 'estimate';

export interface EstimateHeaderView {
  status: SectionStatus;
  pillStatus: StatusPillStatus;
  reviewed: boolean;
  staleReasons: string[];
  meta: GenerationMeta | null;
  prerequisite: string | null;
  isBusy: boolean;
  canGenerate: boolean;
  hasData: boolean;
}

/** Derives the header's view model from the estimate section state, its prerequisite and the global busy flag. */
export function buildEstimateHeaderView(section: SectionState<unknown>, prerequisite: string | null, busy: BusyState | null): EstimateHeaderView {
  const isBusy = busy !== null && busy.stageId === ESTIMATE_STAGE_ID;
  const blockedByOtherWork = busy !== null && busy.stageId !== ESTIMATE_STAGE_ID;
  const pillStatus: StatusPillStatus = section.status === 'current' && section.reviewed ? 'reviewed' : section.status;
  return {
    status: section.status,
    pillStatus,
    reviewed: section.reviewed,
    staleReasons: section.staleReasons,
    meta: section.meta,
    prerequisite,
    isBusy,
    canGenerate: prerequisite === null && !blockedByOtherWork,
    hasData: section.data !== null,
  };
}

/** The estimate stage's own entry in the state layer's stale-action summary, when it is stale. */
export function findEstimatePendingAction(pendingActions: readonly PendingAction[]): PendingAction | null {
  return pendingActions.find((action) => action.stageId === ESTIMATE_STAGE_ID) ?? null;
}

/** 'Recalculate' only when every pending change for the estimate is a pure engine recalculation. */
export function staleActionLabel(pending: PendingAction | null): string {
  return pending?.action === 'recalculate' ? 'Recalculate the estimate' : 'Regenerate the estimate';
}

export function isRecalculateOnly(pending: PendingAction | null): boolean {
  return pending?.action === 'recalculate';
}
