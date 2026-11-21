import type { MissionNodeState } from './missionAvailability.ts';

export const MISSION_ACTION_LABELS: Record<MissionNodeState, string> = {
  available: 'Start',
  in_progress: 'Continue',
  completed: 'Review',
  locked: 'Locked',
};

export function missionActionLabel(state: MissionNodeState): string {
  return MISSION_ACTION_LABELS[state]; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCompletedLabel(completedCount: number, totalCount: number): string {
  return `${completedCount} of ${totalCount} missions complete`;
}
