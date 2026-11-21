import { describe, expect, it } from 'vitest';
import { findResumeTarget, hasTouchedAnyMission } from '../src/journeyEntry.ts';
import {
  linearCatalog,
  makeCatalog,
  makeMissionProgress,
  makeSnapshot,
} from './fixtures.ts';

describe('findResumeTarget', () => {
  it('returns the first mission at the lesson step for a fresh learner', () => {
    const { catalog, ids } = linearCatalog(3);
    const target = findResumeTarget(catalog, makeSnapshot());
    expect(target?.mission.id).toBe(ids[0]);
    expect(target?.step).toBe('lesson');
  });

  it('prefers the in-progress mission and resumes at its furthest step', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
        [ids[1] as string]: makeMissionProgress(ids[1] as string, {
          status: 'in_progress',
          furthestStep: 'checkpoint',
        }),
      },
    });
    const target = findResumeTarget(catalog, snapshot);
    expect(target?.mission.id).toBe(ids[1]);
    expect(target?.step).toBe('checkpoint');
  });

  it('recommends the next unlocked mission when nothing is in progress', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
      },
    });
    const target = findResumeTarget(catalog, snapshot);
    expect(target?.mission.id).toBe(ids[1]);
    expect(target?.step).toBe('lesson');
  });

  it('falls back to the first mission when everything is completed', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
        [ids[1] as string]: makeMissionProgress(ids[1] as string, { status: 'completed' }),
      },
    });
    const target = findResumeTarget(catalog, snapshot);
    expect(target?.mission.id).toBe(ids[0]);
    expect(target?.step).toBe('lesson');
  });

  it('returns undefined for an empty catalog', () => {
    expect(findResumeTarget(makeCatalog([]), makeSnapshot())).toBeUndefined();
  });
});

describe('hasTouchedAnyMission', () => {
  it('is false for a fresh learner', () => {
    const { catalog } = linearCatalog(2);
    expect(hasTouchedAnyMission(catalog, makeSnapshot())).toBe(false);
  });

  it('is true once any mission is in progress or completed', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'in_progress' }),
      },
    });
    expect(hasTouchedAnyMission(catalog, snapshot)).toBe(true);
  });
});
