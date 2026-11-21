import { describe, expect, it } from 'vitest';
import {
  attemptsForMission,
  bestScoreFor,
  hasPassedAttempt,
  isMissionComplete,
  latestAttemptFor,
  recommendNextMission,
} from '../src/missionCompletion.ts';
import {
  iso,
  linearCatalog,
  makeAttempt,
  makeMissionProgress,
  makeSnapshot,
  missionId,
} from './fixtures.ts';

describe('isMissionComplete', () => {
  const attempts = [makeAttempt('attempt-1', 'mission-1', 80)];

  it('requires both a completed checkpoint and a passed attempt', () => {
    expect(
      isMissionComplete({ missionId: missionId('mission-1'), checkpointCompleted: true, attempts }),
    ).toBe(true);
    expect(
      isMissionComplete({ missionId: missionId('mission-1'), checkpointCompleted: false, attempts }),
    ).toBe(false);
    expect(
      isMissionComplete({ missionId: missionId('mission-1'), checkpointCompleted: true, attempts: [] }),
    ).toBe(false);
  });

  it('does not count failed attempts', () => {
    const failed = [makeAttempt('attempt-2', 'mission-1', 40)];
    expect(
      isMissionComplete({ missionId: missionId('mission-1'), checkpointCompleted: true, attempts: failed }),
    ).toBe(false);
  });

  it('ignores attempts from other missions', () => {
    expect(
      isMissionComplete({ missionId: missionId('mission-2'), checkpointCompleted: true, attempts }),
    ).toBe(false);
  });
});

describe('attempt lookups', () => {
  const attempts = [
    { ...makeAttempt('attempt-1', 'mission-1', 60), completedAt: iso('2026-08-01T00:10:00.000Z') },
    { ...makeAttempt('attempt-2', 'mission-1', 90), completedAt: iso('2026-08-02T00:10:00.000Z') },
    makeAttempt('attempt-3', 'mission-2', 75),
  ];

  it('filters attempts by mission', () => {
    expect(attemptsForMission(attempts, missionId('mission-1'))).toHaveLength(2);
  });

  it('detects passed attempts', () => {
    expect(hasPassedAttempt(attempts, missionId('mission-1'))).toBe(true);
    expect(hasPassedAttempt([makeAttempt('a', 'mission-9', 40)], missionId('mission-9'))).toBe(false);
  });

  it('finds the best score', () => {
    expect(bestScoreFor(attempts, missionId('mission-1'))).toBe(90);
    expect(bestScoreFor(attempts, missionId('mission-9'))).toBeUndefined();
  });

  it('finds the latest attempt by completion time', () => {
    expect(latestAttemptFor(attempts, missionId('mission-1'))?.id).toBe('attempt-2');
  });
});

describe('recommendNextMission', () => {
  it('recommends the first unlocked incomplete mission', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
      },
    });
    expect(recommendNextMission(catalog, snapshot, missionId(ids[0] as string))?.id).toBe(ids[1]);
  });

  it('returns undefined when the remaining missions are locked', () => {
    const { catalog, ids } = linearCatalog(3);
    expect(recommendNextMission(catalog, makeSnapshot(), missionId(ids[0] as string))).toBeUndefined();
  });

  it('recommends the first mission when nothing is excluded', () => {
    const { catalog, ids } = linearCatalog(3);
    expect(recommendNextMission(catalog, makeSnapshot())?.id).toBe(ids[0]);
  });

  it('returns undefined when every other mission is completed', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
        [ids[1] as string]: makeMissionProgress(ids[1] as string, { status: 'completed' }),
      },
    });
    expect(recommendNextMission(catalog, snapshot, missionId(ids[0] as string))).toBeUndefined();
  });
});
