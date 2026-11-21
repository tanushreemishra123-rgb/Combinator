import { describe, expect, it } from 'vitest';
import type { QuizAttempt, QuizAnswer } from '@ai-learning-adventure/types';
import {
  hasStruggleSignal,
  latestAttemptOverall,
  quizWeakTopicSignals,
  recommendNextStep,
} from '../src/recommendations.ts';
import {
  linearCatalog,
  makeAttempt,
  makeMissionProgress,
  makeSnapshot,
  missionId,
} from './fixtures.ts';

function wrongAnswer(questionId: string, topic: string): QuizAnswer {
  return {
    questionId: questionId as never,
    selectedOptionIds: ['wrong'],
    isCorrect: false,
    conceptTags: [topic],
  };
}

function attemptWithWrongAnswers(
  id: string,
  missionIdValue: string,
  answers: QuizAnswer[],
  overrides: Partial<QuizAttempt> = {},
): QuizAttempt {
  return {
    ...makeAttempt(id, missionIdValue, 50),
    answers,
    ...overrides,
  };
}

describe('latestAttemptOverall', () => {
  it('returns the attempt with the latest completion time', () => {
    const snapshot = makeSnapshot({
      attempts: [
        { ...makeAttempt('a-1', 'mission-1', 60), completedAt: '2026-08-01T00:00:00.000Z' as never },
        { ...makeAttempt('a-2', 'mission-1', 80), completedAt: '2026-08-02T00:00:00.000Z' as never },
      ],
    });
    expect(latestAttemptOverall(snapshot)?.id).toBe('a-2');
  });

  it('returns undefined without attempts', () => {
    expect(latestAttemptOverall(makeSnapshot())).toBeUndefined();
  });
});

describe('hasStruggleSignal', () => {
  it('is true when the latest attempt needs review', () => {
    const snapshot = makeSnapshot({
      attempts: [
        makeAttempt('a-pass', 'mission-1', 90),
        { ...makeAttempt('a-fail', 'mission-1', 40), completedAt: '2026-08-02T00:00:00.000Z' as never },
      ],
    });
    expect(hasStruggleSignal(snapshot)).toBe(true);
  });

  it('is false when the latest attempt passed', () => {
    const snapshot = makeSnapshot({
      attempts: [
        { ...makeAttempt('a-fail', 'mission-1', 40), completedAt: '2026-08-01T00:00:00.000Z' as never },
        { ...makeAttempt('a-pass', 'mission-1', 90), completedAt: '2026-08-02T00:00:00.000Z' as never },
      ],
    });
    expect(hasStruggleSignal(snapshot)).toBe(false);
  });
});

describe('quizWeakTopicSignals', () => {
  it('ranks topics by miss count with alphabetical tie-break', () => {
    const snapshot = makeSnapshot({
      attempts: [
        attemptWithWrongAnswers('a-1', 'mission-1', [
          wrongAnswer('q-1', 'models'),
          wrongAnswer('q-2', 'data'),
          wrongAnswer('q-3', 'models'),
        ]),
      ],
    });
    const signals = quizWeakTopicSignals(snapshot);
    expect(signals.map((signal) => signal.topic)).toEqual(['models', 'data']);
    expect(signals[0]?.weight).toBe(2);
  });

  it('ignores correct answers', () => {
    const snapshot = makeSnapshot({ attempts: [makeAttempt('a-1', 'mission-1', 100)] });
    expect(quizWeakTopicSignals(snapshot)).toEqual([]);
  });
});

describe('recommendNextStep', () => {
  it('prefers the strongest review topic when a struggle signal exists', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      attempts: [
        attemptWithWrongAnswers('a-1', ids[0] as string, [
          wrongAnswer('q-1', 'data'),
          wrongAnswer('q-2', 'data'),
        ]),
      ],
    });
    const result = recommendNextStep({ catalog, snapshot });
    expect(result.kind).toBe('review');
    if (result.kind !== 'review') return;
    expect(result.review.topic).toBe('data');
    expect(result.review.reason).toBe('You missed 2 questions on this topic');
  });

  it('falls back to the deterministic mission when there is no struggle signal', () => {
    const { catalog, ids } = linearCatalog(3);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
      },
      attempts: [makeAttempt('a-pass', ids[0] as string, 90)],
    });
    const result = recommendNextStep({ catalog, snapshot, excludeMissionId: missionId(ids[0] as string) });
    expect(result.kind).toBe('mission');
    if (result.kind !== 'mission') return;
    expect(result.mission.mission.id).toBe(ids[1]);
    expect(result.mission.source).toBe('deterministic');
    expect(result.mission.reason.length).toBeGreaterThan(0);
  });

  it('keeps the mission recommendation even with weak topics when the latest attempt passed', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      attempts: [
        attemptWithWrongAnswers('a-fail', ids[0] as string, [wrongAnswer('q-1', 'data')], {
          completedAt: '2026-08-01T00:00:00.000Z' as never,
          result: 'needs_review',
        }),
        {
          ...makeAttempt('a-pass', ids[0] as string, 90),
          completedAt: '2026-08-02T00:00:00.000Z' as never,
        },
      ],
    });
    const result = recommendNextStep({ catalog, snapshot });
    expect(result.kind).toBe('mission');
  });

  it('uses provided weak topics over the derived ones', () => {
    const { catalog } = linearCatalog(2);
    const snapshot = makeSnapshot({
      attempts: [
        attemptWithWrongAnswers('a-1', 'mission-1', [wrongAnswer('q-1', 'data')]),
      ],
    });
    const result = recommendNextStep({
      catalog,
      snapshot,
      weakTopics: [{ topic: 'flashcard-topic', weight: 5, sources: ['flashcards'] }],
    });
    expect(result.kind).toBe('review');
    if (result.kind !== 'review') return;
    expect(result.review.topic).toBe('flashcard-topic');
  });

  it('reports journey complete when every mission is done and nothing needs review', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'completed' }),
        [ids[1] as string]: makeMissionProgress(ids[1] as string, { status: 'completed' }),
      },
      attempts: [makeAttempt('a-pass', ids[1] as string, 100)],
    });
    expect(recommendNextStep({ catalog, snapshot }).kind).toBe('journey_complete');
  });

  it('labels in-progress candidates as resume suggestions', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'in_progress' }),
      },
    });
    const result = recommendNextStep({ catalog, snapshot });
    expect(result.kind).toBe('mission');
    if (result.kind !== 'mission') return;
    expect(result.mission.reason).toBe('Pick up where you left off.');
  });

  it('falls back to the excluded mission when later missions stay locked', () => {
    const { catalog, ids } = linearCatalog(2);
    const snapshot = makeSnapshot({
      missions: {
        [ids[0] as string]: makeMissionProgress(ids[0] as string, { status: 'in_progress' }),
      },
      attempts: [makeAttempt('a-pass', ids[0] as string, 90)],
    });
    const result = recommendNextStep({
      catalog,
      snapshot,
      excludeMissionId: missionId(ids[0] as string),
    });
    expect(result.kind).toBe('mission');
    if (result.kind !== 'mission') return;
    expect(result.mission.mission.id).toBe(ids[0]);
  });
});
