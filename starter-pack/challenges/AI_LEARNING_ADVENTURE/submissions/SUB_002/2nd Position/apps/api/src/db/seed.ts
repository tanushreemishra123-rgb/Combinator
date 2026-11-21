import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export interface SeedResult {
  seeded: boolean;
  missions: number;
  questions: number;
  flashcards: number;
  awards: number;
}

function readJsonFile<T>(missionDataDir: string, file: string): T[] {
  const parsed: unknown = JSON.parse(readFileSync(join(missionDataDir, file), 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Seed file "${file}" must contain a JSON array.`);
  }
  return parsed as T[];
}

export function seedFromMissionData(db: AppDatabase, missionDataDir: string): SeedResult {
  const missions = readJsonFile<schema.NewMission>(missionDataDir, 'missions.json');
  const questions = readJsonFile<schema.NewQuizQuestion>(missionDataDir, 'questions.json');
  const flashcards = readJsonFile<schema.NewFlashcard>(missionDataDir, 'flashcards.json');
  const awards = readJsonFile<schema.NewAward>(missionDataDir, 'awards.json');

  const existing = db.select({ n: sql<number>`count(*)` }).from(schema.missions).get();
  const existingCount = existing?.n ?? 0;
  if (existingCount > 0) {
    return { seeded: false, missions: existingCount, questions: 0, flashcards: 0, awards: 0 };
  }

  db.transaction((tx) => {
    if (missions.length > 0) tx.insert(schema.missions).values(missions).run();
    if (questions.length > 0) tx.insert(schema.quizQuestions).values(questions).run();
    if (flashcards.length > 0) tx.insert(schema.flashcards).values(flashcards).run();
    if (awards.length > 0) tx.insert(schema.awards).values(awards).run();
  });

  return {
    seeded: true,
    missions: missions.length,
    questions: questions.length,
    flashcards: flashcards.length,
    awards: awards.length,
  };
}
