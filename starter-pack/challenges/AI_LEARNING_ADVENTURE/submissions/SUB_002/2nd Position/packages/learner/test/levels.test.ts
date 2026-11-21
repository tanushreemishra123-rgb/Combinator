import { describe, expect, it } from 'vitest';
import type { CatalogDto, MissionSummary } from '@ai-learning-adventure/types';
import {
  currentLevelFor,
  deriveLevelLadder,
  nextIncompleteMissionForTrack,
} from '../src/levels.ts';
import { makeCatalog, makeMission, makeMissionProgress, makeSnapshot } from './fixtures.ts';

function trackCatalog(): CatalogDto {
  const missions: MissionSummary[] = [
    makeMission({ id: 'm-b1', levelTrack: 'beginner', trackOrder: 1 }),
    makeMission({ id: 'm-b2', levelTrack: 'beginner', trackOrder: 2 }),
    makeMission({ id: 'm-u1', levelTrack: 'basic_understanding', trackOrder: 1 }),
    makeMission({ id: 'm-a1', levelTrack: 'applied_practice', trackOrder: 1 }),
  ];
  return makeCatalog(missions);
}

describe('currentLevelFor', () => {
  it('starts at the first track with missions', () => {
    expect(currentLevelFor(trackCatalog(), makeSnapshot())).toBe('beginner');
  });

  it('stays in a track until every mission in it is complete', () => {
    const catalog = trackCatalog();
    const partial = makeSnapshot({
      missions: { 'm-b1': makeMissionProgress('m-b1', { status: 'completed' }) },
    });
    expect(currentLevelFor(catalog, partial)).toBe('beginner');

    const full = makeSnapshot({
      missions: {
        'm-b1': makeMissionProgress('m-b1', { status: 'completed' }),
        'm-b2': makeMissionProgress('m-b2', { status: 'completed' }),
      },
    });
    expect(currentLevelFor(catalog, full)).toBe('basic_understanding');
  });

  it('skips tracks without missions', () => {
    const catalog = makeCatalog([
      makeMission({ id: 'm-1', levelTrack: 'beginner', trackOrder: 1 }),
      makeMission({ id: 'm-2', levelTrack: 'responsible_use', trackOrder: 1 }),
    ]);
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    expect(currentLevelFor(catalog, snapshot)).toBe('responsible_use');
  });

  it('keeps the final track once everything is complete', () => {
    const catalog = trackCatalog();
    const snapshot = makeSnapshot({
      missions: {
        'm-b1': makeMissionProgress('m-b1', { status: 'completed' }),
        'm-b2': makeMissionProgress('m-b2', { status: 'completed' }),
        'm-u1': makeMissionProgress('m-u1', { status: 'completed' }),
        'm-a1': makeMissionProgress('m-a1', { status: 'completed' }),
      },
    });
    expect(currentLevelFor(catalog, snapshot)).toBe('builder_mindset');
  });
});

describe('deriveLevelLadder', () => {
  it('marks done, current, and upcoming tracks', () => {
    const catalog = trackCatalog();
    const snapshot = makeSnapshot({
      missions: {
        'm-b1': makeMissionProgress('m-b1', { status: 'completed' }),
        'm-b2': makeMissionProgress('m-b2', { status: 'completed' }),
      },
    });
    const ladder = deriveLevelLadder(catalog, snapshot);
    expect(ladder.map((row) => row.state)).toEqual(['done', 'current', 'upcoming']);
    expect(ladder[0]).toMatchObject({ completedCount: 2, totalCount: 2 });
    expect(ladder[1]).toMatchObject({ completedCount: 0, totalCount: 1 });
  });

  it('omits tracks that have no missions', () => {
    const ladder = deriveLevelLadder(trackCatalog(), makeSnapshot());
    expect(ladder.map((row) => row.levelTrack)).toEqual([
      'beginner',
      'basic_understanding',
      'applied_practice',
    ]);
  });

  it('marks every track done when the journey is complete', () => {
    const catalog = trackCatalog();
    const snapshot = makeSnapshot({
      missions: {
        'm-b1': makeMissionProgress('m-b1', { status: 'completed' }),
        'm-b2': makeMissionProgress('m-b2', { status: 'completed' }),
        'm-u1': makeMissionProgress('m-u1', { status: 'completed' }),
        'm-a1': makeMissionProgress('m-a1', { status: 'completed' }),
      },
    });
    const ladder = deriveLevelLadder(catalog, snapshot);
    expect(ladder.every((row) => row.state === 'done')).toBe(true);
  });
});

describe('nextIncompleteMissionForTrack', () => {
  it('finds the first unlocked incomplete mission in the track', () => {
    const catalog = makeCatalog([
      makeMission({ id: 'm-1', levelTrack: 'beginner', trackOrder: 1 }),
      makeMission({
        id: 'm-2',
        levelTrack: 'beginner',
        trackOrder: 2,
        prerequisiteMissionId: 'm-1',
      }),
    ]);
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
    });
    expect(nextIncompleteMissionForTrack(catalog, snapshot, 'beginner')?.id).toBe('m-2');
  });

  it('returns undefined when the track is complete', () => {
    const catalog = trackCatalog();
    const snapshot = makeSnapshot({
      missions: {
        'm-b1': makeMissionProgress('m-b1', { status: 'completed' }),
        'm-b2': makeMissionProgress('m-b2', { status: 'completed' }),
      },
    });
    expect(nextIncompleteMissionForTrack(catalog, snapshot, 'beginner')).toBeUndefined();
  });
});
