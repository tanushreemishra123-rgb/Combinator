import { describe, expect, it } from 'vitest';
import type { Flashcard, QuizAttempt } from '@ai-learning-adventure/types';
import {
  buildMissionDeck,
  flashcardMatchesTopic,
  rankWeakTopics,
  selectReviewCards,
  shuffleDeck,
} from '../src/flashcards.ts';

function card(id: string, missionId: string, concept: string, conceptTags: string[]): Flashcard {
  return {
    id: id as never,
    missionId: missionId as never,
    concept,
    definition: `Definition of ${concept}`,
    example: `Example of ${concept}`,
    conceptTags,
  };
}

const missedAttempt = {
  id: 'attempt-1',
  missionId: 'mission-1' as never,
  contentVersion: 1,
  answers: [
    {
      questionId: 'q-1' as never,
      selectedOptionIds: ['b'],
      isCorrect: false,
      conceptTags: ['data'],
    },
    {
      questionId: 'q-2' as never,
      selectedOptionIds: ['b'],
      isCorrect: false,
      conceptTags: ['data', 'models'],
    },
    {
      questionId: 'q-3' as never,
      selectedOptionIds: ['a'],
      isCorrect: true,
      conceptTags: ['ethics'],
    },
  ],
  scorePercent: 33,
  correctCount: 1,
  questionCount: 3,
  result: 'needs_review' as const,
  weakTopics: ['data', 'models'],
  startedAt: '2026-08-01T10:00:00.000Z' as never,
  completedAt: '2026-08-01T10:05:00.000Z' as never,
} satisfies QuizAttempt;

describe('rankWeakTopics', () => {
  it('combines quiz misses and needs-work ratings with weights and sources', () => {
    const topics = rankWeakTopics({
      attempts: [missedAttempt],
      needsWorkTagInputs: [{ tags: ['data'] }, { tags: ['prompts'] }],
    });
    expect(topics).toEqual([
      { topic: 'data', weight: 3, sources: ['flashcards', 'quiz'] },
      { topic: 'models', weight: 1, sources: ['quiz'] },
      { topic: 'prompts', weight: 1, sources: ['flashcards'] },
    ]);
  });

  it('returns an empty list when there are no signals', () => {
    expect(rankWeakTopics({ attempts: [], needsWorkTagInputs: [] })).toEqual([]);
  });
});

describe('flashcardMatchesTopic', () => {
  it('matches any concept tag', () => {
    const dataCard = card('c-1', 'mission-1', 'Data', ['data', 'training']);
    expect(flashcardMatchesTopic(dataCard, 'data')).toBe(true);
    expect(flashcardMatchesTopic(dataCard, 'training')).toBe(true);
    expect(flashcardMatchesTopic(dataCard, 'models')).toBe(false);
  });
});

describe('buildMissionDeck', () => {
  it('sorts cards by mission, concept, and id without mutating input', () => {
    const cards = [
      card('c-2', 'mission-2', 'Alpha', []),
      card('c-1', 'mission-1', 'Beta', []),
      card('c-3', 'mission-1', 'Alpha', []),
    ];
    const deck = buildMissionDeck(cards);
    expect(deck.map((c) => c.id as string)).toEqual(['c-3', 'c-1', 'c-2']);
    expect(cards[0]?.id).toBe('c-2');
  });
});

describe('selectReviewCards', () => {
  const cards = [
    card('c-1', 'mission-1', 'Data', ['data']),
    card('c-2', 'mission-1', 'Models', ['models']),
    card('c-3', 'mission-2', 'Prompts', ['prompts']),
    card('c-4', 'mission-2', 'Ethics', ['ethics']),
  ];

  it('excludes cards rated got_it and reports the skip count', () => {
    const selection = selectReviewCards({
      cards,
      ratings: { 'c-1': { rating: 'got_it', reviewCount: 2, updatedAt: 'x' as never } },
    });
    expect(selection.cards.map((c) => c.id as string)).toEqual(['c-2', 'c-4', 'c-3']);
    expect(selection.skippedKnownCount).toBe(1);
  });

  it('filters to a topic when requested', () => {
    const selection = selectReviewCards({
      cards,
      ratings: {},
      topics: ['prompts'],
    });
    expect(selection.cards.map((c) => c.id as string)).toEqual(['c-3']);
  });

  it('keeps needs-work cards and de-duplicates ids', () => {
    const selection = selectReviewCards({
      cards: [...cards, card('c-2', 'mission-1', 'Models', ['models'])],
      ratings: { 'c-2': { rating: 'needs_work', reviewCount: 1, updatedAt: 'x' as never } },
    });
    expect(selection.cards.map((c) => c.id as string)).toEqual(['c-1', 'c-2', 'c-4', 'c-3']);
  });

  it('returns no cards when everything is known', () => {
    const ratings = Object.fromEntries(
      cards.map((c) => [
        c.id as string,
        { rating: 'got_it' as const, reviewCount: 1, updatedAt: 'x' as never },
      ]),
    );
    const selection = selectReviewCards({ cards, ratings });
    expect(selection.cards).toEqual([]);
    expect(selection.skippedKnownCount).toBe(4);
  });
});

describe('shuffleDeck', () => {
  it('shuffles deterministically by seed', () => {
    const cards = [card('c-1', 'm', 'A', []), card('c-2', 'm', 'B', []), card('c-3', 'm', 'C', [])];
    expect(shuffleDeck(cards, 5)).toEqual(shuffleDeck(cards, 5));
    expect(shuffleDeck(cards, 6).map((c) => c.id)).not.toEqual(shuffleDeck(cards, 5).map((c) => c.id));
  });
});
