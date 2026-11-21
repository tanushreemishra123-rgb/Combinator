import type {
  Flashcard,
  FlashcardRatingState,
  QuizAttempt,
} from '@ai-learning-adventure/types';
import { shuffleItems, type WeakTopicSignal } from './quiz.ts';

export type WeakTopicSource = 'quiz' | 'flashcards';

export interface NeedsWorkTagInput {
  tags: readonly string[];
}

export function rankWeakTopics(input: {
  attempts: readonly QuizAttempt[];
  needsWorkTagInputs: readonly NeedsWorkTagInput[];
}): WeakTopicSignal[] {
  const byTopic = new Map<string, { weight: number; sources: Set<WeakTopicSource> }>();
  const add = (topic: string, source: WeakTopicSource) => {
    const entry = byTopic.get(topic) ?? { weight: 0, sources: new Set<WeakTopicSource>() };
    entry.weight += 1;
    entry.sources.add(source);
    byTopic.set(topic, entry);
  };

  for (const attempt of input.attempts) {
    for (const answer of attempt.answers) {
      if (answer.isCorrect) continue;
      for (const topic of answer.conceptTags) add(topic, 'quiz');
    }
  }
  for (const inputTags of input.needsWorkTagInputs) {
    for (const topic of inputTags.tags) add(topic, 'flashcards');
  }

  return [...byTopic.entries()]
    .map(([topic, entry]) => ({
      topic,
      weight: entry.weight,
      sources: [...entry.sources].sort() as WeakTopicSource[],
    }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}

export function flashcardMatchesTopic(card: Flashcard, topic: string): boolean {
  return card.conceptTags.includes(topic);
}

function compareCards(a: Flashcard, b: Flashcard): number {
  return (
    (a.missionId as string).localeCompare(b.missionId as string) ||
    a.concept.localeCompare(b.concept) ||
    (a.id as string).localeCompare(b.id as string)
  );
}

export function buildMissionDeck(cards: readonly Flashcard[]): Flashcard[] {
  return [...cards].sort(compareCards);
}

export interface ReviewDeckSelection {
  cards: Flashcard[];
  skippedKnownCount: number;
}

export function selectReviewCards(input: {
  cards: readonly Flashcard[];
  ratings: Record<string, FlashcardRatingState>;
  topics?: readonly string[];
}): ReviewDeckSelection {
  const topics = input.topics !== undefined ? new Set(input.topics) : undefined;
  const seen = new Set<string>();
  const cards: Flashcard[] = [];
  let skippedKnownCount = 0;
  for (const card of input.cards) {
    if (seen.has(card.id as string)) continue;
    seen.add(card.id as string);
    if (input.ratings[card.id as string]?.rating === 'got_it') { // nosemgrep: gitlab.eslint.detect-object-injection
      skippedKnownCount += 1;
      continue;
    }
    if (topics !== undefined && !card.conceptTags.some((topic) => topics.has(topic))) continue;
    cards.push(card);
  }
  return { cards: cards.sort(compareCards), skippedKnownCount };
}

export function shuffleDeck(cards: readonly Flashcard[], seed: number): Flashcard[] {
  return shuffleItems(cards, seed);
}

export function flashcardFromDeckById(
  cards: readonly Flashcard[],
  cardId: string,
): Flashcard | undefined {
  return cards.find((card) => (card.id as string) === cardId);
}
