import { and, eq } from 'drizzle-orm';
import type { QueryClient } from '../client.ts';
import * as schema from '../schema.ts';

export function getLearner(db: QueryClient, learnerId: string): schema.Learner | undefined {
  return db.select().from(schema.learners).where(eq(schema.learners.id, learnerId)).get();
}

export function ensureLearner(
  db: QueryClient,
  learnerId: string,
  schemaVersion: number,
  now: string,
): schema.Learner {
  const existing = getLearner(db, learnerId);
  if (existing) return existing;
  const row: schema.NewLearner = { id: learnerId, schemaVersion, createdAt: now, updatedAt: now };
  try {
    db.insert(schema.learners).values(row).run();
  } catch {
    const concurrent = getLearner(db, learnerId);
    if (concurrent) return concurrent;
    throw new Error(`Unable to create learner record "${learnerId}".`);
  }
  return row;
}

export function touchLearner(db: QueryClient, learnerId: string, now: string): void {
  db.update(schema.learners).set({ updatedAt: now }).where(eq(schema.learners.id, learnerId)).run();
}

export function listMissionProgress(db: QueryClient, learnerId: string): schema.MissionProgress[] {
  return db
    .select()
    .from(schema.missionProgress)
    .where(eq(schema.missionProgress.learnerId, learnerId))
    .orderBy(schema.missionProgress.missionId)
    .all();
}

export function getMissionProgress(
  db: QueryClient,
  learnerId: string,
  missionId: string,
): schema.MissionProgress | undefined {
  return db
    .select()
    .from(schema.missionProgress)
    .where(
      and(eq(schema.missionProgress.learnerId, learnerId), eq(schema.missionProgress.missionId, missionId)),
    )
    .get();
}

export function upsertMissionProgress(db: QueryClient, row: schema.NewMissionProgress): void {
  db.insert(schema.missionProgress)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.missionProgress.learnerId, schema.missionProgress.missionId],
      set: row,
    })
    .run();
}

export function listQuizAttempts(db: QueryClient, learnerId: string): schema.QuizAttempt[] {
  return db
    .select()
    .from(schema.quizAttempts)
    .where(eq(schema.quizAttempts.learnerId, learnerId))
    .orderBy(schema.quizAttempts.completedAt, schema.quizAttempts.id)
    .all();
}

export function getQuizAttempt(db: QueryClient, attemptId: string): schema.QuizAttempt | undefined {
  return db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.id, attemptId)).get();
}

export function insertQuizAttempt(db: QueryClient, row: schema.NewQuizAttempt): void {
  db.insert(schema.quizAttempts).values(row).run();
}

export function insertQuizAttemptIfAbsent(db: QueryClient, row: schema.NewQuizAttempt): void {
  db.insert(schema.quizAttempts)
    .values(row)
    .onConflictDoNothing({ target: schema.quizAttempts.id })
    .run();
}

export function listFlashcardRatings(db: QueryClient, learnerId: string): schema.FlashcardRating[] {
  return db
    .select()
    .from(schema.flashcardRatings)
    .where(eq(schema.flashcardRatings.learnerId, learnerId))
    .orderBy(schema.flashcardRatings.flashcardId)
    .all();
}

export function getFlashcardRating(
  db: QueryClient,
  learnerId: string,
  flashcardId: string,
): schema.FlashcardRating | undefined {
  return db
    .select()
    .from(schema.flashcardRatings)
    .where(
      and(
        eq(schema.flashcardRatings.learnerId, learnerId),
        eq(schema.flashcardRatings.flashcardId, flashcardId),
      ),
    )
    .get();
}

export function upsertFlashcardRating(db: QueryClient, row: schema.NewFlashcardRating): void {
  db.insert(schema.flashcardRatings)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.flashcardRatings.learnerId, schema.flashcardRatings.flashcardId],
      set: row,
    })
    .run();
}

export function listEarnedAwards(db: QueryClient, learnerId: string): schema.EarnedAward[] {
  return db
    .select()
    .from(schema.earnedAwards)
    .where(eq(schema.earnedAwards.learnerId, learnerId))
    .orderBy(schema.earnedAwards.earnedAt, schema.earnedAwards.awardId)
    .all();
}

export function insertEarnedAward(db: QueryClient, row: schema.NewEarnedAward): void {
  db.insert(schema.earnedAwards)
    .values(row)
    .onConflictDoNothing({ target: [schema.earnedAwards.learnerId, schema.earnedAwards.awardId] })
    .run();
}

export function getIdempotencyRecord(
  db: QueryClient,
  learnerId: string,
  idempotencyKey: string,
): schema.ProgressIdempotencyRecord | undefined {
  return db
    .select()
    .from(schema.progressIdempotency)
    .where(
      and(
        eq(schema.progressIdempotency.learnerId, learnerId),
        eq(schema.progressIdempotency.idempotencyKey, idempotencyKey),
      ),
    )
    .get();
}

export function insertIdempotencyRecord(db: QueryClient, row: schema.NewProgressIdempotencyRecord): void {
  db.insert(schema.progressIdempotency).values(row).run();
}

export function deleteLearnerProgress(db: QueryClient, learnerId: string): void {
  db.delete(schema.missionProgress).where(eq(schema.missionProgress.learnerId, learnerId)).run();
  db.delete(schema.quizAttempts).where(eq(schema.quizAttempts.learnerId, learnerId)).run();
  db.delete(schema.flashcardRatings).where(eq(schema.flashcardRatings.learnerId, learnerId)).run();
  db.delete(schema.earnedAwards).where(eq(schema.earnedAwards.learnerId, learnerId)).run();
  db.delete(schema.progressIdempotency).where(eq(schema.progressIdempotency.learnerId, learnerId)).run();
}
