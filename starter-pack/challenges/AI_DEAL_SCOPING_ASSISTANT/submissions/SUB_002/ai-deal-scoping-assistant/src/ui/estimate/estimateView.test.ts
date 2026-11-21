import { describe, expect, it } from 'vitest';
import type { SectionState } from '../../domain';
import type { PendingAction } from '../../impact';
import { buildEstimateHeaderView, findEstimatePendingAction, isRecalculateOnly, staleActionLabel } from './estimateView';

function section(overrides: Partial<SectionState<unknown>> = {}): SectionState<unknown> {
  return { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [], ...overrides };
}

function pendingAction(overrides: Partial<PendingAction> = {}): PendingAction {
  return { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'regenerate', sections: ['estimate'], reasons: [], ...overrides };
}

describe('buildEstimateHeaderView', () => {
  it('can generate when there is no prerequisite and nothing else is busy', () => {
    const view = buildEstimateHeaderView(section(), null, null);
    expect(view.canGenerate).toBe(true);
    expect(view.hasData).toBe(false);
  });

  it('cannot generate while a prerequisite is missing', () => {
    const view = buildEstimateHeaderView(section(), 'Generate the PRD before estimating the delivery.', null);
    expect(view.canGenerate).toBe(false);
    expect(view.prerequisite).toBe('Generate the PRD before estimating the delivery.');
  });

  it('cannot generate while a different stage is busy', () => {
    const view = buildEstimateHeaderView(section(), null, { label: 'Generating the PRD...', stageId: 'prd' });
    expect(view.canGenerate).toBe(false);
    expect(view.isBusy).toBe(false);
  });

  it('is busy only when the global busy state names the estimate stage itself', () => {
    const view = buildEstimateHeaderView(section(), null, { label: 'Estimating...', stageId: 'estimate' });
    expect(view.isBusy).toBe(true);
  });

  it('reads as reviewed only when current and marked reviewed', () => {
    const view = buildEstimateHeaderView(section({ data: {}, status: 'current', reviewed: true }), null, null);
    expect(view.pillStatus).toBe('reviewed');
    expect(view.hasData).toBe(true);
  });

  it('keeps the stale pill even when previously reviewed', () => {
    const view = buildEstimateHeaderView(section({ data: {}, status: 'stale', reviewed: true, staleReasons: ['Rate card changed'] }), null, null);
    expect(view.pillStatus).toBe('stale');
    expect(view.staleReasons).toEqual(['Rate card changed']);
  });
});

describe('findEstimatePendingAction', () => {
  it('finds the estimate stage entry among several pending actions', () => {
    const found = findEstimatePendingAction([pendingAction({ stageId: 'prd' }), pendingAction({ stageId: 'estimate', action: 'recalculate' })]);
    expect(found?.action).toBe('recalculate');
  });

  it('returns null when the estimate stage is not pending', () => {
    expect(findEstimatePendingAction([pendingAction({ stageId: 'prd' })])).toBeNull();
  });
});

describe('staleActionLabel / isRecalculateOnly', () => {
  it('offers to recalculate when every pending change is a pure engine recalculation', () => {
    const pending = pendingAction({ action: 'recalculate' });
    expect(staleActionLabel(pending)).toBe('Recalculate the estimate');
    expect(isRecalculateOnly(pending)).toBe(true);
  });

  it('offers to regenerate when the AI stage must run again', () => {
    const pending = pendingAction({ action: 'regenerate' });
    expect(staleActionLabel(pending)).toBe('Regenerate the estimate');
    expect(isRecalculateOnly(pending)).toBe(false);
  });

  it('defaults to regenerate when there is no pending action at all', () => {
    expect(staleActionLabel(null)).toBe('Regenerate the estimate');
    expect(isRecalculateOnly(null)).toBe(false);
  });
});
