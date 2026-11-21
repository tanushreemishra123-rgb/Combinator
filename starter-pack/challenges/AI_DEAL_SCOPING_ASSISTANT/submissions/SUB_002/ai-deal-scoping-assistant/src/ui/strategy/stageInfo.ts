/**
 * Pure view-model for a generation stage's status row (StageSummaryCard). Kept outside the
 * component so the gating rules - when the generate action is enabled, which status pill to show -
 * are unit-testable without React and stay in one place instead of being re-decided per tab.
 */
import type { GenerationMeta, SectionState, SectionStatus } from '../../domain';
import type { BusyState, StageId } from '../../state';
import type { StatusPillStatus } from '../common';

export interface StageView {
  status: SectionStatus;
  pillStatus: StatusPillStatus;
  reviewed: boolean;
  staleReasons: string[];
  meta: GenerationMeta | null;
  prerequisite: string | null;
  /** True only when the global busy state names this exact stage. */
  isBusy: boolean;
  canGenerate: boolean;
}

/** Derives the status row's view model for one stage from its section state, prerequisite and the global busy flag. */
export function buildStageView(
  section: SectionState<unknown>,
  stageId: StageId,
  prerequisite: string | null,
  busy: BusyState | null,
): StageView {
  const isBusy = busy !== null && busy.stageId === stageId;
  const blockedByOtherWork = busy !== null && busy.stageId !== stageId;
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
  };
}
