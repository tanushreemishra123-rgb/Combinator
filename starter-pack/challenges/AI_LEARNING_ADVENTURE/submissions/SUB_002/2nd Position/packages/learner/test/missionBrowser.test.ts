import { describe, expect, it } from 'vitest';
import { deriveMissionAvailability } from '../src/missionAvailability.ts';
import {
  countActiveFilters,
  filterMissionBrowserItems,
  sortMissionBrowserItems,
} from '../src/missionBrowser.ts';
import {
  makeCatalog,
  makeMission,
  makeMissionProgress,
  makeSnapshot,
} from './fixtures.ts';

const missions = [
  makeMission({ id: 'm-1', title: 'Alpha', levelTrack: 'beginner', trackOrder: 1, difficulty: 'beginner' }),
  makeMission({ id: 'm-2', title: 'Charlie', levelTrack: 'beginner', trackOrder: 2, difficulty: 'intermediate', prerequisiteMissionId: 'm-1' }),
  makeMission({ id: 'm-3', title: 'Bravo', levelTrack: 'applied_practice', trackOrder: 1, difficulty: 'intermediate', prerequisiteMissionId: 'm-2' }),
  makeMission({ id: 'm-4', title: 'Delta', levelTrack: 'builder_mindset', trackOrder: 1, difficulty: 'advanced', prerequisiteMissionId: 'm-3' }),
];

function buildItems(completedIds: string[] = [], inProgressId?: string) {
  const missionProgress: Record<string, ReturnType<typeof makeMissionProgress>> = {};
  for (const id of completedIds) {
    missionProgress[id] = makeMissionProgress(id, { status: 'completed' }); // nosemgrep: gitlab.eslint.detect-object-injection
  }
  if (inProgressId !== undefined) {
    missionProgress[inProgressId] = makeMissionProgress(inProgressId, { status: 'in_progress' }); // nosemgrep: gitlab.eslint.detect-object-injection
  }
  return deriveMissionAvailability(makeCatalog(missions), makeSnapshot({ missions: missionProgress }));
}

describe('filterMissionBrowserItems', () => {
  it('returns every item when no filters are active', () => {
    const items = buildItems();
    const filtered = filterMissionBrowserItems(items, { difficulties: [], tracks: [], statuses: [] });
    expect(filtered).toHaveLength(4);
    expect(countActiveFilters({ difficulties: [], tracks: [], statuses: [] })).toBe(0);
  });

  it('applies OR within a filter group', () => {
    const items = buildItems();
    const filtered = filterMissionBrowserItems(items, {
      difficulties: ['beginner', 'advanced'],
      tracks: [],
      statuses: [],
    });
    expect(filtered.map((item) => item.mission.id)).toEqual(['m-1', 'm-4']);
  });

  it('intersects across filter groups', () => {
    const items = buildItems(['m-1'], 'm-2');
    const filtered = filterMissionBrowserItems(items, {
      difficulties: ['beginner', 'intermediate'],
      tracks: ['beginner'],
      statuses: ['in_progress'],
    });
    expect(filtered.map((item) => item.mission.id)).toEqual(['m-2']);
  });

  it('filters by status', () => {
    const items = buildItems(['m-1', 'm-2']);
    const filtered = filterMissionBrowserItems(items, {
      difficulties: [],
      tracks: [],
      statuses: ['completed'],
    });
    expect(filtered.map((item) => item.mission.id)).toEqual(['m-1', 'm-2']);
  });

  it('returns an empty list when nothing matches', () => {
    const items = buildItems();
    const filtered = filterMissionBrowserItems(items, {
      difficulties: [],
      tracks: ['responsible_use'],
      statuses: [],
    });
    expect(filtered).toEqual([]);
  });
});

describe('sortMissionBrowserItems', () => {
  it('keeps track order for track_order sort', () => {
    const items = buildItems();
    const sorted = sortMissionBrowserItems(items, 'track_order');
    expect(sorted.map((item) => item.mission.id)).toEqual(['m-1', 'm-2', 'm-3', 'm-4']);
  });

  it('sorts alphabetically by title', () => {
    const items = buildItems();
    const sorted = sortMissionBrowserItems(items, 'title');
    expect(sorted.map((item) => item.mission.title)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('sorts by difficulty with track-order tie-break', () => {
    const items = buildItems();
    const sorted = sortMissionBrowserItems(items, 'difficulty');
    expect(sorted.map((item) => item.mission.id)).toEqual(['m-1', 'm-2', 'm-3', 'm-4']);
  });

  it('sorts completed first, then in progress, then not started', () => {
    const items = buildItems(['m-1'], 'm-2');
    const sorted = sortMissionBrowserItems(items, 'progress');
    expect(sorted.map((item) => item.mission.id)).toEqual(['m-1', 'm-2', 'm-3', 'm-4']);
  });

  it('does not mutate the input array', () => {
    const items = buildItems();
    const original = items.map((item) => item.mission.id);
    sortMissionBrowserItems(items, 'title');
    expect(items.map((item) => item.mission.id)).toEqual(original);
  });
});
