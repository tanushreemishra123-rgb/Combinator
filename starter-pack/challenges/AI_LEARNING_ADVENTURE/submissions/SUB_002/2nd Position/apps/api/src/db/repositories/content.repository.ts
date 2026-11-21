import { and, eq, inArray } from 'drizzle-orm';
import type { LevelTrack } from '@ai-learning-adventure/types';
import type { QueryClient } from '../client.ts';
import * as schema from '../schema.ts';

export const LEVEL_TRACK_SEQUENCE: LevelTrack[] = [
  'beginner',
  'basic_understanding',
  'applied_practice',
  'responsible_use',
  'builder_mindset',
];

const trackRank = new Map<string, number>(LEVEL_TRACK_SEQUENCE.map((track, index) => [track, index]));

function compareMissions(a: schema.Mission, b: schema.Mission): number {
  const rankA = trackRank.get(a.levelTrack) ?? LEVEL_TRACK_SEQUENCE.length;
  const rankB = trackRank.get(b.levelTrack) ?? LEVEL_TRACK_SEQUENCE.length;
  return rankA - rankB || a.trackOrder - b.trackOrder || a.id.localeCompare(b.id);
}

export function listVisibleMissions(db: QueryClient): schema.Mission[] {
  const rows = db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.status, 'published'), eq(schema.missions.enabled, true)))
    .all();
  return rows.sort(compareMissions);
}

export function getVisibleMission(db: QueryClient, missionId: string): schema.Mission | undefined {
  return db
    .select()
    .from(schema.missions)
    .where(
      and(
        eq(schema.missions.id, missionId),
        eq(schema.missions.status, 'published'),
        eq(schema.missions.enabled, true),
      ),
    )
    .get();
}

export function listVisibleQuestions(db: QueryClient, missionId: string): schema.QuizQuestion[] {
  return db
    .select()
    .from(schema.quizQuestions)
    .where(
      and(
        eq(schema.quizQuestions.missionId, missionId),
        eq(schema.quizQuestions.status, 'published'),
        eq(schema.quizQuestions.enabled, true),
      ),
    )
    .orderBy(schema.quizQuestions.displayOrder, schema.quizQuestions.id)
    .all();
}

export function listVisibleFlashcards(db: QueryClient, missionId: string): schema.Flashcard[] {
  return db
    .select()
    .from(schema.flashcards)
    .where(
      and(
        eq(schema.flashcards.missionId, missionId),
        eq(schema.flashcards.status, 'published'),
        eq(schema.flashcards.enabled, true),
      ),
    )
    .orderBy(schema.flashcards.displayOrder, schema.flashcards.id)
    .all();
}

export function getVisibleFlashcard(db: QueryClient, flashcardId: string): schema.Flashcard | undefined {
  return db
    .select()
    .from(schema.flashcards)
    .where(
      and(
        eq(schema.flashcards.id, flashcardId),
        eq(schema.flashcards.status, 'published'),
        eq(schema.flashcards.enabled, true),
      ),
    )
    .get();
}

export function getFlashcardsByIds(db: QueryClient, flashcardIds: string[]): schema.Flashcard[] {
  if (flashcardIds.length === 0) return [];
  return db.select().from(schema.flashcards).where(inArray(schema.flashcards.id, flashcardIds)).all();
}

export function listVisibleAwards(db: QueryClient): schema.Award[] {
  return db
    .select()
    .from(schema.awards)
    .where(and(eq(schema.awards.status, 'published'), eq(schema.awards.enabled, true)))
    .orderBy(schema.awards.id)
    .all();
}

export function listVisibleAwardsForMission(db: QueryClient, missionId: string): schema.Award[] {
  return db
    .select()
    .from(schema.awards)
    .where(
      and(
        eq(schema.awards.missionId, missionId),
        eq(schema.awards.status, 'published'),
        eq(schema.awards.enabled, true),
      ),
    )
    .orderBy(schema.awards.id)
    .all();
}
