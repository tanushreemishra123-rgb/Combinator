/**
 * Pure mapping from the state layer's journey-step statuses to the sidebar's presentational
 * `StatusPillStatus`, and aggregation of a workspace's own status from the steps that belong to it
 * (a workspace needs attention if any of its steps does, is reviewed only once every step is done).
 */
import type { JourneyStep } from '../../state';
import type { StatusPillStatus } from '../../ui/common';

const JOURNEY_STATUS_TO_PILL: ReadonlyMap<JourneyStep['status'], StatusPillStatus> = new Map([
  ['todo', 'empty'],
  ['active', 'current'],
  ['done', 'reviewed'],
  ['attention', 'stale'],
]);

export function journeyStatusToPill(status: JourneyStep['status']): StatusPillStatus {
  return JOURNEY_STATUS_TO_PILL.get(status) ?? 'empty';
}

export function workspaceStatusFromJourney(journey: readonly JourneyStep[], workspaceId: string): StatusPillStatus {
  const steps = journey.filter((step) => step.workspaceId === workspaceId);
  if (steps.length === 0) {
    return 'empty';
  }
  if (steps.some((step) => step.status === 'attention')) {
    return 'stale';
  }
  if (steps.every((step) => step.status === 'done')) {
    return 'reviewed';
  }
  if (steps.some((step) => step.status === 'active' || step.status === 'done')) {
    return 'current';
  }
  return 'empty';
}
