import type { Difficulty, LevelTrack, MissionProgressStatus } from '@ai-learning-adventure/types';
import {
  compareDifficulties,
  compareLevelTracks,
  compareMissionStatuses,
} from './tracks.ts';
import type { MissionBrowserItem } from './missionAvailability.ts';

export interface MissionBrowserFilters {
  difficulties: Difficulty[];
  tracks: LevelTrack[];
  statuses: MissionProgressStatus[];
}

export type MissionSort = 'track_order' | 'title' | 'difficulty' | 'progress';

export const EMPTY_MISSION_FILTERS: MissionBrowserFilters = {
  difficulties: [],
  tracks: [],
  statuses: [],
};

export function countActiveFilters(filters: MissionBrowserFilters): number {
  return filters.difficulties.length + filters.tracks.length + filters.statuses.length;
}

function matchesGroup<T>(selected: readonly T[], value: T): boolean {
  return selected.length === 0 || selected.includes(value);
}

export function matchesMissionFilters(
  item: MissionBrowserItem,
  filters: MissionBrowserFilters,
): boolean {
  return (
    matchesGroup(filters.difficulties, item.mission.difficulty) &&
    matchesGroup(filters.tracks, item.mission.levelTrack) &&
    matchesGroup(filters.statuses, item.status)
  );
}

export function filterMissionBrowserItems(
  items: readonly MissionBrowserItem[],
  filters: MissionBrowserFilters,
): MissionBrowserItem[] {
  if (countActiveFilters(filters) === 0) return [...items];
  return items.filter((item) => matchesMissionFilters(item, filters));
}

function compareByTrackOrder(a: MissionBrowserItem, b: MissionBrowserItem): number {
  return (
    compareLevelTracks(a.mission.levelTrack, b.mission.levelTrack) ||
    a.mission.trackOrder - b.mission.trackOrder ||
    a.mission.id.localeCompare(b.mission.id)
  );
}

export function sortMissionBrowserItems(
  items: readonly MissionBrowserItem[],
  sort: MissionSort,
): MissionBrowserItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'title':
      sorted.sort((a, b) => a.mission.title.localeCompare(b.mission.title) || compareByTrackOrder(a, b));
      break;
    case 'difficulty':
      sorted.sort(
        (a, b) =>
          compareDifficulties(a.mission.difficulty, b.mission.difficulty) || compareByTrackOrder(a, b),
      );
      break;
    case 'progress':
      sorted.sort(
        (a, b) => compareMissionStatuses(b.status, a.status) || compareByTrackOrder(a, b),
      );
      break;
    case 'track_order':
      sorted.sort(compareByTrackOrder);
      break;
  }
  return sorted;
}
