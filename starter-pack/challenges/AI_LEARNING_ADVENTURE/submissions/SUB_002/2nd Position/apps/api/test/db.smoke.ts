import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, and, sql } from 'drizzle-orm';
import { openDatabase } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';

const dir = mkdtempSync(join(tmpdir(), 'dbtest-'));
const file = join(dir, 'test.db');
const { sqlite, db, close } = openDatabase(file);

try {
  const now = new Date().toISOString();

  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);
  for (const t of [
    'missions',
    'quiz_questions',
    'flashcards',
    'awards',
    'learners',
    'mission_progress',
    'quiz_attempts',
    'flashcard_ratings',
    'earned_awards',
    'progress_idempotency',
  ]) {
    assert.ok(tables.includes(t), `missing table ${t}`);
  }

  const indexes = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);
  for (const i of [
    'missions_track_order_idx',
    'quiz_questions_mission_order_idx',
    'flashcards_mission_order_idx',
    'mission_progress_learner_status_idx',
    'quiz_attempts_learner_mission_completed_idx',
    'earned_awards_learner_idx',
  ]) {
    assert.ok(indexes.includes(i), `missing index ${i}`);
  }

  db.insert(s.missions)
    .values([
      {
        id: 'm1',
        slug: 'what-is-ai',
        title: 'What is AI?',
        difficulty: 'beginner',
        levelTrack: 'beginner',
        trackOrder: 1,
        objective: 'Understand AI basics',
        lessonJson: '[]',
        exampleJson: '{}',
        checkpointJson: '{}',
        estimatedMinutes: 10,
        status: 'published',
        enabled: true,
        contentVersion: 1,
        publishedAt: now,
        updatedAt: now,
      },
      {
        id: 'm2',
        slug: 'ml-in-practice',
        title: 'ML in Practice',
        difficulty: 'intermediate',
        levelTrack: 'basic_understanding',
        trackOrder: 1,
        objective: 'Apply ML concepts',
        lessonJson: '[]',
        exampleJson: '{}',
        checkpointJson: '{}',
        estimatedMinutes: 15,
        prerequisiteMissionId: 'm1',
        status: 'published',
        enabled: true,
        contentVersion: 1,
        publishedAt: now,
        updatedAt: now,
      },
    ])
    .run();

  const passDefault = sqlite
    .prepare('SELECT pass_threshold FROM missions WHERE id = ?')
    .get('m1') as { pass_threshold: number };
  assert.equal(passDefault.pass_threshold, 70);

  db.insert(s.quizQuestions)
    .values({
      id: 'q1',
      missionId: 'm1',
      type: 'multiple_choice',
      stem: 'Which is AI?',
      scenario: null,
      selectionMode: 'single',
      optionsJson: '[]',
      correctExplanation: 'yes',
      incorrectExplanation: 'no',
      conceptTagsJson: '["ai"]',
      difficulty: 'beginner',
      allowsReasoning: false,
      displayOrder: 1,
      status: 'published',
      enabled: true,
      updatedAt: now,
    })
    .run();

  db.insert(s.flashcards)
    .values({
      id: 'f1',
      missionId: 'm1',
      concept: 'AI',
      definition: 'Artificial intelligence',
      example: 'A chatbot',
      commonMistake: null,
      learningTip: null,
      conceptTagsJson: '["ai"]',
      difficulty: 'beginner',
      displayOrder: 1,
      status: 'published',
      enabled: true,
      updatedAt: now,
    })
    .run();

  db.insert(s.awards)
    .values({
      id: 'a1',
      kind: 'badge',
      name: 'First Steps',
      icon: 'badge-first',
      description: 'Completed first mission',
      missionId: 'm1',
      ruleType: 'mission_completed',
      ruleJson: '{"missionId":"m1"}',
      status: 'published',
      enabled: true,
      updatedAt: now,
    })
    .run();

  db.insert(s.learners)
    .values({ id: 'learner-1', schemaVersion: 1, createdAt: now, updatedAt: now })
    .run();

  db.insert(s.missionProgress)
    .values({
      learnerId: 'learner-1',
      missionId: 'm1',
      status: 'in_progress',
      furthestStep: 'example',
      checkpointCompleted: false,
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    })
    .run();

  db.insert(s.quizAttempts)
    .values({
      id: 'attempt-1',
      learnerId: 'learner-1',
      missionId: 'm1',
      contentVersion: 1,
      answersJson: '[]',
      scorePercent: 100,
      correctCount: 1,
      questionCount: 1,
      result: 'passed',
      weakTopicsJson: '[]',
      startedAt: now,
      completedAt: now,
    })
    .run();

  db.insert(s.flashcardRatings)
    .values({
      learnerId: 'learner-1',
      flashcardId: 'f1',
      rating: 'got_it',
      reviewCount: 1,
      updatedAt: now,
    })
    .run();

  db.insert(s.earnedAwards)
    .values({
      learnerId: 'learner-1',
      awardId: 'a1',
      earnedAt: now,
      sourceJson: '{}',
    })
    .run();

  db.insert(s.progressIdempotency)
    .values({
      learnerId: 'learner-1',
      idempotencyKey: 'key-1',
      operation: 'updateMissionProgress',
      responseJson: '{}',
      createdAt: now,
    })
    .run();

  const missionRows = db
    .select()
    .from(s.missions)
    .where(and(eq(s.missions.status, 'published'), eq(s.missions.enabled, true)))
    .orderBy(s.missions.levelTrack, s.missions.trackOrder)
    .all();
  assert.equal(missionRows.length, 2);
  assert.deepEqual(
    missionRows.map((m) => m.id).sort(),
    ['m1', 'm2'],
  );
  assert.equal(missionRows[0]?.enabled, true);

  const progress = db
    .select()
    .from(s.missionProgress)
    .where(eq(s.missionProgress.learnerId, 'learner-1'))
    .get();
  assert.equal(progress?.furthestStep, 'example');
  assert.equal(progress?.checkpointCompleted, false);

  const joined = db
    .select({ award: s.awards.name, earnedAt: s.earnedAwards.earnedAt })
    .from(s.earnedAwards)
    .innerJoin(s.awards, eq(s.earnedAwards.awardId, s.awards.id))
    .where(eq(s.earnedAwards.learnerId, 'learner-1'))
    .all();
  assert.equal(joined.length, 1);
  assert.equal(joined[0]?.award, 'First Steps');

  // FK enforcement: progress row for unknown learner must fail
  assert.throws(() => {
    db.insert(s.missionProgress)
      .values({
        learnerId: 'ghost',
        missionId: 'm1',
        status: 'not_started',
        furthestStep: 'lesson',
        checkpointCompleted: false,
        updatedAt: now,
      })
      .run();
  });

  // Cascade: deleting the learner removes owned progress rows
  db.delete(s.learners).where(eq(s.learners.id, 'learner-1')).run();
  const remaining = db
    .select()
    .from(s.missionProgress)
    .where(eq(s.missionProgress.missionId, 'm1'))
    .all();
  assert.equal(remaining.length, 0);
  const remainingAttempts = db.select().from(s.quizAttempts).all();
  assert.equal(remainingAttempts.length, 0);

  // Transaction support
  const result = db.transaction((tx) => {
    tx.insert(s.learners)
      .values({ id: 'learner-2', schemaVersion: 1, createdAt: now, updatedAt: now })
      .run();
    return tx.select().from(s.learners).where(eq(s.learners.id, 'learner-2')).get();
  });
  assert.equal(result?.id, 'learner-2');

  // Idempotent re-open: ensureSchema must not fail on existing tables
  close();
  const reopened = openDatabase(file);
  const count = reopened.db.select({ n: sql<number>`count(*)` }).from(s.missions).get();
  assert.equal(count?.n, 2);
  reopened.close();

  console.log('DB smoke test passed');
} finally {
  try {
    close();
  } catch {
    // already closed
  }
  rmSync(dir, { recursive: true, force: true });
}
