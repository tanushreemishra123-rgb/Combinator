import { describe, expect, it } from 'vitest';
import { deriveMissionAvailability } from '../src/missionAvailability.ts';
import {
  linearCatalog,
  makeAttempt,
  makeCatalog,
  makeMission,
  makeMissionProgress,
  makeSnapshot,
  missionId,
} from './fixtures.ts';

describe('deriveMissionAvailability', () => {
  it('marks the first mission available and the rest locked for a fresh learner', () => {
    const { catalog, ids } = linearCatalog(3);
    const items = deriveMissionAvailability(catalog, makeSnapshot());
    expect(items.map((item) => item.state)).toEqual(['available', 'locked', 'locked']);
    expect(items[1]?.prerequisite?.id).toBe(missionId(ids[0] as string));
  });

  it('unlocks the mission after a completed prerequisite', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: { [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }) },
    });
    const items = deriveMissionAvailability(catalog, snapshot);
    expect(items.map((item) => item.state)).toEqual(['completed', 'available', 'locked']);
  });

  it('keeps an in-progress mission open even when statuses are inconsistent', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: { [ids[1] as string]: makeMissionProgress(ids[1] as string, { status: 'in_progress' }) },
    });
    const items = deriveMissionAvailability(catalog, snapshot);
    expect(items[1]?.state).toBe('in_progress');
    expect(items[2]?.state).toBe('locked');
  });

  it('exposes the best attempt score per mission', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      attempts: [
        makeAttempt('attempt-1', ids[0] as string, 60),
        makeAttempt('attempt-2', ids[0] as string, 80),
        makeAttempt('attempt-3', ids[1] as string, 40),
      ],
    });
    const items = deriveMissionAvailability(catalog, snapshot);
    expect(items[0]?.bestScore).toBe(80);
    expect(items[1]?.bestScore).toBe(40);
  });

  it('counts only earned mission badges', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: { [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }) },
      earnedAwardIds: [`award-${ids[0]}`],
    });
    const items = deriveMissionAvailability(catalog, snapshot);
    expect(items[0]?.earnedBadgeCount).toBe(1);
    expect(items[1]?.earnedBadgeCount).toBe(0);
  });

  it('handles a mission without prerequisite as available', () => {
    const catalog = makeCatalog([makeMission({ id: 'solo' })]);
    const items = deriveMissionAvailability(catalog, makeSnapshot());
    expect(items[0]?.state).toBe('available');
    expect(items[0]?.prerequisite).toBeUndefined();
  });

  it('returns an empty list for an empty catalog', () => {
    expect(deriveMissionAvailability(makeCatalog([]), makeSnapshot())).toEqual([]);
  });
});
