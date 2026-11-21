/** Unit tests for the pure journey-status -> sidebar-pill mapping used by SidebarContainer. */
import type { JourneyStep } from '../../state';
import { journeyStatusToPill, workspaceStatusFromJourney } from './sidebarStatus';

function step(overrides: Partial<JourneyStep> = {}): JourneyStep {
  return { id: 'understand', label: 'Understand the customer need', hint: '', status: 'todo', workspaceId: 'requirements', ...overrides };
}

describe('journeyStatusToPill', () => {
  it('maps every journey status to its sidebar pill', () => {
    expect(journeyStatusToPill('todo')).toBe('empty');
    expect(journeyStatusToPill('active')).toBe('current');
    expect(journeyStatusToPill('done')).toBe('reviewed');
    expect(journeyStatusToPill('attention')).toBe('stale');
  });
});

describe('workspaceStatusFromJourney', () => {
  it('is empty when the workspace has no steps at all', () => {
    expect(workspaceStatusFromJourney([step({ workspaceId: 'requirements' })], 'estimate')).toBe('empty');
  });

  it('is empty when every step of the workspace is still todo', () => {
    const steps = [step({ status: 'todo' }), step({ id: 'review-scope', status: 'todo' })];
    expect(workspaceStatusFromJourney(steps, 'requirements')).toBe('empty');
  });

  it('is stale when any step needs attention, even if others are done', () => {
    const steps = [step({ status: 'done' }), step({ id: 'clarify', status: 'attention' })];
    expect(workspaceStatusFromJourney(steps, 'requirements')).toBe('stale');
  });

  it('is reviewed only once every step of the workspace is done', () => {
    const steps = [step({ status: 'done' }), step({ id: 'review-scope', status: 'done' })];
    expect(workspaceStatusFromJourney(steps, 'requirements')).toBe('reviewed');
  });

  it('is current while at least one step is active or done but not all are done', () => {
    const steps = [step({ status: 'active' }), step({ id: 'review-scope', status: 'todo' })];
    expect(workspaceStatusFromJourney(steps, 'requirements')).toBe('current');
  });

  it('only looks at steps belonging to the requested workspace', () => {
    const steps = [step({ status: 'attention', workspaceId: 'prd' }), step({ status: 'todo', workspaceId: 'requirements' })];
    expect(workspaceStatusFromJourney(steps, 'requirements')).toBe('empty');
  });
});
