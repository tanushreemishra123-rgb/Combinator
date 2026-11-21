import { describe, expect, it } from 'vitest';
import type { QuizAnswer, QuizAttempt } from '@ai-learning-adventure/types';
import {
  deriveProgressProjection,
  missionProgressRows,
  scoreSeries,
} from '../src/progress.ts';
import {
  makeAttempt,
  makeCatalog,
  makeMission,
  makeMissionProgress,
  makeSnapshot,
} from './fixtures.ts';

function attemptAt(id: string, missionIdValue: string, scorePercent: number, completedAt: string): QuizAttempt {
  return {
    ...makeAttempt(id, missionIdValue, scorePercent),
    completedAt: completedAt as never,
  };
}

describe('deriveProgressProjection', () => {
  const catalog = makeCatalog([
    makeMission({ id: 'm-1', levelTrack: 'beginner', trackOrder: 1 }),
    makeMission({ id: 'm-2', levelTrack: 'beginner', trackOrder: 2 }),
    makeMission({ id: 'm-3', levelTrack: 'basic_understanding', trackOrder: 1 }),
  ]);

  it('returns zeros for an empty catalog', () => {
    const projection = deriveProgressProjection(makeCatalog([]), makeSnapshot());
    expect(projection.completionPercent).toBe(0);
    expect(projection.completedMissionCount).toBe(0);
    expect(projection.currentLevel).toBe('builder_mindset');
  });

  it('computes completion percent, scores, and current level', () => {
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
      attempts: [
        attemptAt('a-1', 'm-1', 60, '2026-08-01T00:00:00.000Z'),
        attemptAt('a-2', 'm-1', 90, '2026-08-02T00:00:00.000Z'),
      ],
    });
    const projection = deriveProgressProjection(catalog, snapshot);
    expect(projection.completionPercent).toBe(33);
    expect(projection.completedMissionCount).toBe(1);
    expect(projection.currentLevel).toBe('beginner');
    expect(projection.bestScoreByMission['m-1']).toBe(90);
    expect(projection.latestScoreByMission['m-1']).toBe(90);
  });

  it('derives weak topics from wrong answers', () => {
    const wrong: QuizAnswer = {
      questionId: 'q-1' as never,
      selectedOptionIds: ['wrong'],
      isCorrect: false,
      conceptTags: ['data'],
    };
    const snapshot = makeSnapshot({
      attempts: [{ ...attemptAt('a-1', 'm-1', 50, '2026-08-01T00:00:00.000Z'), answers: [wrong] }],
    });
    const projection = deriveProgressProjection(catalog, snapshot);
    expect(projection.weakTopics.map((topic) => topic.topic)).toEqual(['data']);
  });
});

describe('scoreSeries', () => {
  it('orders points by completion time then attempt id', () => {
    const points = scoreSeries([
      attemptAt('a-2', 'm-1', 80, '2026-08-02T00:00:00.000Z'),
      attemptAt('a-1', 'm-1', 60, '2026-08-01T00:00:00.000Z'),
      attemptAt('a-0', 'm-1', 70, '2026-08-01T00:00:00.000Z'),
    ]);
    expect(points.map((point) => point.attemptId)).toEqual(['a-0', 'a-1', 'a-2']);
    expect(points[0]?.scorePercent).toBe(70);
  });

  it('returns an empty series without attempts', () => {
    expect(scoreSeries([])).toEqual([]);
  });
});

describe('missionProgressRows', () => {
  it('reports status and best/latest scores per catalog mission', () => {
    const catalog = makeCatalog([
      makeMission({ id: 'm-1', trackOrder: 1 }),
      makeMission({ id: 'm-2', trackOrder: 2 }),
    ]);
    const snapshot = makeSnapshot({
      missions: { 'm-1': makeMissionProgress('m-1', { status: 'completed' }) },
      attempts: [
        attemptAt('a-1', 'm-1', 60, '2026-08-01T00:00:00.000Z'),
        attemptAt('a-2', 'm-1', 90, '2026-08-02T00:00:00.000Z'),
      ],
    });
    const rows = missionProgressRows(catalog, snapshot);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      missionId: 'm-1',
      status: 'completed',
      bestScore: 90,
      latestScore: 90,
    });
    expect(rows[1]).toEqual({ missionId: 'm-2', status: 'not_started' });
  });
});
