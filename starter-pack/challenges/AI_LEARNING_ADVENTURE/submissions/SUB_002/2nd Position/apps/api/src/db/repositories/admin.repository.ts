import { and, asc, desc, eq } from 'drizzle-orm';
import type { AdminEntityType } from '@ai-learning-adventure/types';
import type { QueryClient } from '../client.ts';
import * as schema from '../schema.ts';

export function listAllContentItems(db: QueryClient): schema.ContentItem[] {
  return db.select().from(schema.contentItems).orderBy(asc(schema.contentItems.updatedAt)).all();
}

export function listContentItemsByType(db: QueryClient, entityType: AdminEntityType): schema.ContentItem[] {
  return db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.entityType, entityType))
    .orderBy(asc(schema.contentItems.updatedAt))
    .all();
}

export function getContentItem(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
): schema.ContentItem | undefined {
  return db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.entityType, entityType), eq(schema.contentItems.entityId, entityId)))
    .get();
}

export function insertContentItem(db: QueryClient, item: schema.NewContentItem): void {
  db.insert(schema.contentItems).values(item).run();
}

export function updateContentItem(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
  patch: Partial<schema.NewContentItem>,
): void {
  db.update(schema.contentItems)
    .set(patch)
    .where(and(eq(schema.contentItems.entityType, entityType), eq(schema.contentItems.entityId, entityId)))
    .run();
}

export function deleteContentItem(db: QueryClient, entityType: AdminEntityType, entityId: string): void {
  db.delete(schema.contentItems)
    .where(and(eq(schema.contentItems.entityType, entityType), eq(schema.contentItems.entityId, entityId)))
    .run();
}

export function insertPublishHistory(db: QueryClient, entry: schema.NewContentPublishHistoryEntry): void {
  db.insert(schema.contentPublishHistory).values(entry).run();
}

export function listPublishHistory(
  db: QueryClient,
  entityType: AdminEntityType,
  entityId: string,
): schema.ContentPublishHistoryEntry[] {
  return db
    .select()
    .from(schema.contentPublishHistory)
    .where(
      and(
        eq(schema.contentPublishHistory.entityType, entityType),
        eq(schema.contentPublishHistory.entityId, entityId),
      ),
    )
    .orderBy(desc(schema.contentPublishHistory.seq))
    .all();
}

export function getMissionSnapshot(
  db: QueryClient,
  missionId: string,
  contentVersion: number,
): schema.MissionContentVersion | undefined {
  return db
    .select()
    .from(schema.missionContentVersions)
    .where(
      and(
        eq(schema.missionContentVersions.missionId, missionId),
        eq(schema.missionContentVersions.contentVersion, contentVersion),
      ),
    )
    .get();
}

export function upsertMissionSnapshot(db: QueryClient, snapshot: schema.NewMissionContentVersion): void {
  const existing = getMissionSnapshot(db, snapshot.missionId, snapshot.contentVersion);
  if (existing) {
    db.update(schema.missionContentVersions)
      .set({ bundleJson: snapshot.bundleJson, createdAt: snapshot.createdAt })
      .where(
        and(
          eq(schema.missionContentVersions.missionId, snapshot.missionId),
          eq(schema.missionContentVersions.contentVersion, snapshot.contentVersion),
        ),
      )
      .run();
    return;
  }
  db.insert(schema.missionContentVersions).values(snapshot).run();
}

export function getMissionRow(db: QueryClient, missionId: string): schema.Mission | undefined {
  return db.select().from(schema.missions).where(eq(schema.missions.id, missionId)).get();
}

export function upsertMissionRow(db: QueryClient, row: schema.Mission): void {
  const existing = getMissionRow(db, row.id);
  if (existing) {
    db.update(schema.missions).set(row).where(eq(schema.missions.id, row.id)).run();
    return;
  }
  db.insert(schema.missions).values(row).run();
}

export function setMissionStatus(db: QueryClient, missionId: string, status: schema.ContentStatus): void {
  db.update(schema.missions).set({ status }).where(eq(schema.missions.id, missionId)).run();
}

export function setMissionEnabled(db: QueryClient, missionId: string, enabled: boolean): void {
  db.update(schema.missions).set({ enabled }).where(eq(schema.missions.id, missionId)).run();
}

export function listAllMissionRows(db: QueryClient): schema.Mission[] {
  return db.select().from(schema.missions).all();
}

export function getQuestionRow(db: QueryClient, questionId: string): schema.QuizQuestion | undefined {
  return db.select().from(schema.quizQuestions).where(eq(schema.quizQuestions.id, questionId)).get();
}

export function upsertQuestionRow(db: QueryClient, row: schema.QuizQuestion): void {
  const existing = getQuestionRow(db, row.id);
  if (existing) {
    db.update(schema.quizQuestions).set(row).where(eq(schema.quizQuestions.id, row.id)).run();
    return;
  }
  db.insert(schema.quizQuestions).values(row).run();
}

export function setQuestionStatus(db: QueryClient, questionId: string, status: schema.ContentStatus): void {
  db.update(schema.quizQuestions).set({ status }).where(eq(schema.quizQuestions.id, questionId)).run();
}

export function setQuestionEnabled(db: QueryClient, questionId: string, enabled: boolean): void {
  db.update(schema.quizQuestions).set({ enabled }).where(eq(schema.quizQuestions.id, questionId)).run();
}

export function getFlashcardRow(db: QueryClient, flashcardId: string): schema.Flashcard | undefined {
  return db.select().from(schema.flashcards).where(eq(schema.flashcards.id, flashcardId)).get();
}

export function upsertFlashcardRow(db: QueryClient, row: schema.Flashcard): void {
  const existing = getFlashcardRow(db, row.id);
  if (existing) {
    db.update(schema.flashcards).set(row).where(eq(schema.flashcards.id, row.id)).run();
    return;
  }
  db.insert(schema.flashcards).values(row).run();
}

export function setFlashcardStatus(db: QueryClient, flashcardId: string, status: schema.ContentStatus): void {
  db.update(schema.flashcards).set({ status }).where(eq(schema.flashcards.id, flashcardId)).run();
}

export function setFlashcardEnabled(db: QueryClient, flashcardId: string, enabled: boolean): void {
  db.update(schema.flashcards).set({ enabled }).where(eq(schema.flashcards.id, flashcardId)).run();
}

export function getAwardRow(db: QueryClient, awardId: string): schema.Award | undefined {
  return db.select().from(schema.awards).where(eq(schema.awards.id, awardId)).get();
}

export function upsertAwardRow(db: QueryClient, row: schema.Award): void {
  const existing = getAwardRow(db, row.id);
  if (existing) {
    db.update(schema.awards).set(row).where(eq(schema.awards.id, row.id)).run();
    return;
  }
  db.insert(schema.awards).values(row).run();
}

export function setAwardStatus(db: QueryClient, awardId: string, status: schema.ContentStatus): void {
  db.update(schema.awards).set({ status }).where(eq(schema.awards.id, awardId)).run();
}

export function setAwardEnabled(db: QueryClient, awardId: string, enabled: boolean): void {
  db.update(schema.awards).set({ enabled }).where(eq(schema.awards.id, awardId)).run();
}

export function listQuestionRowsForMission(db: QueryClient, missionId: string): schema.QuizQuestion[] {
  return db
    .select()
    .from(schema.quizQuestions)
    .where(eq(schema.quizQuestions.missionId, missionId))
    .orderBy(asc(schema.quizQuestions.displayOrder))
    .all();
}

export function listFlashcardRowsForMission(db: QueryClient, missionId: string): schema.Flashcard[] {
  return db
    .select()
    .from(schema.flashcards)
    .where(eq(schema.flashcards.missionId, missionId))
    .orderBy(asc(schema.flashcards.displayOrder))
    .all();
}

export function listAwardRowsForMission(db: QueryClient, missionId: string): schema.Award[] {
  return db.select().from(schema.awards).where(eq(schema.awards.missionId, missionId)).all();
}
