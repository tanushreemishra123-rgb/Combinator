import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CatalogDto,
  FlashcardRatingMutationDto,
  MissionDetailDto,
  ProgressMutationDto,
  ProgressSnapshotDto,
  QuizAttemptMutationDto,
} from '@ai-learning-adventure/types';
import { createApp } from '../src/app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'api-contract-'));

const app = createApp({
  host: '127.0.0.1',
  port: 0,
  databaseFile: join(workDir, 'contract.db'),
  missionDataDir: join(here, '..', 'mission-data'),
  corsOrigin: '*',
  bodyLimitBytes: 256 * 1024,
  schemaVersion: 1,
});
assert.equal(app.seedResult.seeded, true);
assert.ok(app.seedResult.missions >= 8, 'expected at least 8 seeded missions');

const server = createServer(app.handler);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address !== null && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;

interface CallResult<T> {
  status: number;
  body: T;
  headers: Headers;
}

async function call<T>(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  // Test requests are restricted to the ephemeral loopback server created above.
  // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf
  const res = await fetch(base + path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) as T, headers: res.headers };
}

type Success<T> = { data: T; meta?: { requestId: string; etag?: string } };
type Failure = { error: { code: string; message: string; requestId: string } };

const t1 = '2026-08-12T09:00:00.000Z';
const learner = 'learner-contract-1';

try {
  // health
  {
    const res = await call<Success<{ status: string; database: string }>>('GET', '/api/v1/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { status: 'ok', database: 'ok' });
    assert.ok(res.body.meta?.requestId);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  }

  // catalog
  let catalog: CatalogDto;
  {
    const res = await call<Success<CatalogDto>>('GET', '/api/v1/catalog');
    assert.equal(res.status, 200);
    catalog = res.body.data;
    assert.ok(catalog.missions.length >= 8);
    assert.ok(catalog.awards.length >= 8);
    assert.ok(
      catalog.awards.some((award) => award.kind === 'milestone'),
      'catalog includes milestone awards',
    );
    assert.ok(catalog.contentVersion.length > 0);
    assert.ok(res.body.meta?.etag);
    assert.equal(res.headers.get('etag'), null, 'etag travels in meta, not header');

    const missionsOnly = await call<Success<CatalogDto>>('GET', '/api/v1/catalog?include=missions');
    assert.equal(missionsOnly.body.data.awards.length, 0);
    assert.ok(missionsOnly.body.data.missions.length >= 8);
    assert.equal(missionsOnly.body.data.contentVersion, catalog.contentVersion);

    const invalid = await call<Failure>('GET', '/api/v1/catalog?include=bogus');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'validation_error');
    assert.ok(invalid.body.error.requestId);

    const wrongMethod = await call<Failure>('POST', '/api/v1/catalog');
    assert.equal(wrongMethod.status, 405);
  }

  // mission detail
  const missionId = catalog.missions[0]!.id;
  let detail: MissionDetailDto;
  {
    const res = await call<Success<MissionDetailDto>>('GET', `/api/v1/missions/${missionId}`);
    assert.equal(res.status, 200);
    detail = res.body.data;
    assert.equal(detail.mission.id, missionId);
    assert.ok(detail.mission.lesson.length > 0);
    assert.ok(detail.mission.checkpoint);
    assert.ok(detail.mission.questions.length >= 5);
    assert.ok(detail.mission.flashcards.length >= 3);
    assert.ok(detail.mission.awards.length >= 1);
    assert.equal(detail.mission.passThreshold, 70);

    const missing = await call<Failure>('GET', '/api/v1/missions/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'not_found');
  }

  // empty progress snapshot, learner auto-created
  {
    const res = await call<Success<ProgressSnapshotDto>>('GET', `/api/v1/learners/${learner}/progress`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.learnerId, learner);
    assert.equal(res.body.data.schemaVersion, 1);
    assert.deepEqual(res.body.data.missions, {});
    assert.deepEqual(res.body.data.attempts, []);
    assert.deepEqual(res.body.data.flashcardRatings, {});
    assert.deepEqual(res.body.data.earnedAwards, []);
    assert.ok(res.body.data.revision);
  }

  // mission progress: advance, idempotent replay, monotonic furthest step
  {
    const payload = {
      idempotencyKey: 'mp-1',
      furthestStep: 'example',
      occurredAt: t1,
    };
    const res = await call<Success<ProgressMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/missions/${missionId}/progress`,
      { body: payload },
    );
    assert.equal(res.status, 200);
    const progress = res.body.data.snapshot.missions[missionId];
    assert.ok(progress);
    assert.equal(progress!.furthestStep, 'example');
    assert.equal(progress!.status, 'in_progress');
    assert.equal(progress!.startedAt, t1);
    assert.deepEqual(res.body.data.newlyEarnedAwards, []);

    const replay = await call<Success<ProgressMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/missions/${missionId}/progress`,
      { body: payload },
    );
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.data, res.body.data);

    const regress = await call<Success<ProgressMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/missions/${missionId}/progress`,
      { body: { idempotencyKey: 'mp-2', furthestStep: 'lesson', occurredAt: t1 } },
    );
    assert.equal(regress.body.data.snapshot.missions[missionId]!.furthestStep, 'example');

    const unknownMission = await call<Failure>(
      'PUT',
      `/api/v1/learners/${learner}/missions/nope/progress`,
      { body: { ...payload, idempotencyKey: 'mp-unknown' } },
    );
    assert.equal(unknownMission.status, 404);
  }

  // checkpoint completion
  {
    const res = await call<Success<ProgressMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/missions/${missionId}/progress`,
      {
        body: {
          idempotencyKey: 'mp-3',
          furthestStep: 'checkpoint',
          checkpointCompleted: true,
          occurredAt: '2026-08-12T09:05:00.000Z',
        },
      },
    );
    const progress = res.body.data.snapshot.missions[missionId];
    assert.equal(progress!.checkpointCompleted, true);
    assert.equal(progress!.status, 'in_progress', 'completion still requires a passed quiz');
  }

  // quiz attempt: all correct -> passed, completion, badge earned
  const buildAnswers = (correct: boolean) =>
    detail.mission.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: correct
        ? question.options.filter((option) => option.isCorrect).map((option) => option.id)
        : [question.options.find((option) => !option.isCorrect)!.id],
    }));

  const attemptBase = {
    missionId,
    contentVersion: detail.mission.contentVersion,
    startedAt: '2026-08-12T09:10:00.000Z',
    completedAt: '2026-08-12T09:15:00.000Z',
  };

  let passingAttempt: QuizAttemptMutationDto;
  {
    const res = await call<Success<QuizAttemptMutationDto>>(
      'POST',
      `/api/v1/learners/${learner}/quiz-attempts`,
      {
        body: {
          idempotencyKey: 'qa-1',
          attempt: { id: 'attempt-pass-1', ...attemptBase, answers: buildAnswers(true) },
          completionCandidate: true,
          awardCandidateIds: ['award-ai-basics'],
        },
      },
    );
    assert.equal(res.status, 200);
    passingAttempt = res.body.data;
    assert.equal(passingAttempt.attempt.result, 'passed');
    assert.equal(passingAttempt.attempt.scorePercent, 100);
    assert.equal(passingAttempt.attempt.correctCount, passingAttempt.attempt.questionCount);
    for (const answer of passingAttempt.attempt.answers) {
      assert.equal(answer.isCorrect, true, 'server recomputed correctness');
    }
    const progress = passingAttempt.snapshot.missions[missionId];
    assert.equal(progress!.status, 'completed');
    assert.equal(progress!.furthestStep, 'result');
    assert.ok(progress!.completedAt);
    assert.ok((passingAttempt.newlyEarnedAwards as string[]).includes('award-ai-basics'));
    assert.ok(passingAttempt.snapshot.earnedAwards.some((entry) => entry.awardId === 'award-ai-basics'));
    assert.ok(
      (passingAttempt.newlyEarnedAwards as string[]).includes('milestone-first-steps'),
      'percent milestone earned at 10% complete',
    );
    assert.ok(
      (passingAttempt.newlyEarnedAwards as string[]).includes('milestone-perfect-score'),
      'score milestone earned for a perfect quiz',
    );
    assert.ok(
      !(passingAttempt.newlyEarnedAwards as string[]).includes('milestone-halfway'),
      'unmet milestones are not earned',
    );
    assert.ok(
      !(passingAttempt.newlyEarnedAwards as string[]).includes('milestone-track-beginner'),
      'track milestone waits for the whole track',
    );

    const replay = await call<Success<QuizAttemptMutationDto>>(
      'POST',
      `/api/v1/learners/${learner}/quiz-attempts`,
      {
        body: {
          idempotencyKey: 'qa-1',
          attempt: { id: 'attempt-pass-1', ...attemptBase, answers: buildAnswers(true) },
          completionCandidate: true,
          awardCandidateIds: [],
        },
      },
    );
    assert.deepEqual(replay.body.data, passingAttempt);

    const duplicateAttempt = await call<Success<QuizAttemptMutationDto>>(
      'POST',
      `/api/v1/learners/${learner}/quiz-attempts`,
      {
        body: {
          idempotencyKey: 'qa-2',
          attempt: { id: 'attempt-pass-1', ...attemptBase, answers: buildAnswers(true) },
          completionCandidate: true,
          awardCandidateIds: [],
        },
      },
    );
    assert.equal(duplicateAttempt.status, 200);
    assert.equal(duplicateAttempt.body.data.snapshot.attempts.length, 1, 'attempt stays immutable');
    assert.deepEqual(duplicateAttempt.body.data.newlyEarnedAwards, []);
  }

  // failing attempt: server recomputes score and weak topics
  {
    const res = await call<Success<QuizAttemptMutationDto>>(
      'POST',
      `/api/v1/learners/${learner}/quiz-attempts`,
      {
        body: {
          idempotencyKey: 'qa-3',
          attempt: { id: 'attempt-fail-1', ...attemptBase, answers: buildAnswers(false) },
          completionCandidate: false,
          awardCandidateIds: [],
        },
      },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.attempt.result, 'needs_review');
    assert.equal(res.body.data.attempt.scorePercent, 0);
    assert.ok(res.body.data.attempt.weakTopics.length > 0);
    assert.equal(res.body.data.snapshot.attempts.length, 2);
    assert.equal(
      res.body.data.snapshot.missions[missionId]!.status,
      'completed',
      'completion is monotonic despite a later failing attempt',
    );

    const staleVersion = await call<Failure>('POST', `/api/v1/learners/${learner}/quiz-attempts`, {
      body: {
        idempotencyKey: 'qa-4',
        attempt: {
          id: 'attempt-stale',
          ...attemptBase,
          contentVersion: attemptBase.contentVersion + 99,
          answers: buildAnswers(true),
        },
        completionCandidate: false,
        awardCandidateIds: [],
      },
    });
    assert.equal(staleVersion.status, 409);
    assert.equal(staleVersion.body.error.code, 'content_version_mismatch');
  }

  // flashcard ratings
  const flashcardId = detail.mission.flashcards[0]!.id;
  {
    const res = await call<Success<FlashcardRatingMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/flashcards/${flashcardId}/rating`,
      { body: { idempotencyKey: 'fr-1', rating: 'needs_work', occurredAt: '2026-08-12T09:20:00.000Z' } },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.reviewCount, 1);
    assert.equal(res.body.data.rating, 'needs_work');
    assert.ok(res.body.data.weakTopics.length > 0);
    const topic = res.body.data.weakTopics[0]!;
    assert.ok(topic.topic.length > 0 && topic.weight >= 1 && topic.sources.length > 0);

    const replay = await call<Success<FlashcardRatingMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/flashcards/${flashcardId}/rating`,
      { body: { idempotencyKey: 'fr-1', rating: 'needs_work', occurredAt: '2026-08-12T09:20:00.000Z' } },
    );
    assert.deepEqual(replay.body.data, res.body.data, 'duplicate rating is not counted twice');

    const second = await call<Success<FlashcardRatingMutationDto>>(
      'PUT',
      `/api/v1/learners/${learner}/flashcards/${flashcardId}/rating`,
      { body: { idempotencyKey: 'fr-2', rating: 'got_it', occurredAt: '2026-08-12T09:25:00.000Z' } },
    );
    assert.equal(second.body.data.reviewCount, 2);
    assert.equal(second.body.data.rating, 'got_it');

    const missingCard = await call<Failure>(
      'PUT',
      `/api/v1/learners/${learner}/flashcards/nope/rating`,
      { body: { idempotencyKey: 'fr-3', rating: 'got_it', occurredAt: t1 } },
    );
    assert.equal(missingCard.status, 404);
  }

  // reset progress, then restore the exported snapshot (backup/restore round-trip)
  let portable: {
    schemaVersion: number;
    exportedAt: string;
    missions: ProgressSnapshotDto['missions'];
    attempts: ProgressSnapshotDto['attempts'];
    flashcardRatings: ProgressSnapshotDto['flashcardRatings'];
    earnedAwards: ProgressSnapshotDto['earnedAwards'];
  };
  {
    const source = await call<Success<ProgressSnapshotDto>>('GET', `/api/v1/learners/${learner}/progress`);
    const snapshot = source.body.data;
    assert.equal(snapshot.attempts.length, 2);
    portable = {
      schemaVersion: snapshot.schemaVersion,
      exportedAt: '2026-08-12T10:00:00.000Z',
      missions: snapshot.missions,
      attempts: snapshot.attempts,
      flashcardRatings: snapshot.flashcardRatings,
      earnedAwards: snapshot.earnedAwards,
    };

    const res = await call<Success<ProgressSnapshotDto>>('DELETE', `/api/v1/learners/${learner}/progress`, {
      headers: { 'idempotency-key': 'reset-1' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.missions, {});
    assert.deepEqual(res.body.data.attempts, []);
    assert.deepEqual(res.body.data.earnedAwards, []);
    assert.equal(res.body.data.learnerId, learner, 'anonymous learner shell is retained');

    const replay = await call<Success<ProgressSnapshotDto>>('DELETE', `/api/v1/learners/${learner}/progress`, {
      headers: { 'idempotency-key': 'reset-1' },
    });
    assert.deepEqual(replay.body.data, res.body.data);

    const after = await call<Success<ProgressSnapshotDto>>('GET', `/api/v1/learners/${learner}/progress`);
    assert.deepEqual(after.body.data.missions, {});

    const missingKey = await call<Failure>('DELETE', `/api/v1/learners/${learner}/progress`);
    assert.equal(missingKey.status, 400);
  }

  // import the exported snapshot back into the same learner
  {
    const res = await call<Success<ProgressSnapshotDto>>(
      'POST',
      `/api/v1/learners/${learner}/progress/import`,
      { body: { idempotencyKey: 'imp-1', snapshot: portable, mode: 'replace' } },
    );
    assert.equal(res.status, 200);
    const imported = res.body.data;
    assert.equal(imported.learnerId, learner);
    assert.equal(imported.missions[missionId]!.status, 'completed');
    assert.equal(imported.missions[missionId]!.checkpointCompleted, true);
    assert.equal(imported.attempts.length, 2);
    const importedPassing = imported.attempts.find((attempt) => attempt.id === 'attempt-pass-1');
    assert.ok(importedPassing);
    assert.equal(importedPassing!.result, 'passed', 'imported attempts are regraded');
    assert.equal(importedPassing!.scorePercent, 100);
    assert.ok(imported.earnedAwards.some((entry) => entry.awardId === 'award-ai-basics'));
    assert.ok(imported.flashcardRatings[flashcardId]);

    const replay = await call<Success<ProgressSnapshotDto>>(
      'POST',
      `/api/v1/learners/${learner}/progress/import`,
      { body: { idempotencyKey: 'imp-1', snapshot: portable, mode: 'replace' } },
    );
    assert.deepEqual(replay.body.data, imported);

    const badMode = await call<Failure>('POST', `/api/v1/learners/${learner}/progress/import`, {
      body: { idempotencyKey: 'imp-2', snapshot: portable, mode: 'merge' },
    });
    assert.equal(badMode.status, 400);

    // importing a snapshot that references unknown content ids drops those entries
    const tampered = {
      ...portable,
      missions: { ...portable.missions, 'ghost-mission': portable.missions[missionId]! },
      earnedAwards: [...portable.earnedAwards, { awardId: 'ghost-award', earnedAt: portable.exportedAt }],
    };
    const filtered = await call<Success<ProgressSnapshotDto>>(
      'POST',
      `/api/v1/learners/${learner}/progress/import`,
      { body: { idempotencyKey: 'imp-3', snapshot: tampered, mode: 'replace' } },
    );
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.data.missions['ghost-mission'], undefined);
    assert.ok(!filtered.body.data.earnedAwards.some((entry) => entry.awardId === 'ghost-award'));
  }

  // validation and routing errors
  {
    const missingIdempotency = await call<Failure>('POST', `/api/v1/learners/${learner}/quiz-attempts`, {
      body: { attempt: { id: 'x' } },
    });
    assert.equal(missingIdempotency.status, 400);
    assert.equal(missingIdempotency.body.error.code, 'validation_error');

    const unknownRoute = await call<Failure>('GET', '/api/v1/unknown');
    assert.equal(unknownRoute.status, 404);

    const wrongMethod = await call<Failure>('GET', `/api/v1/learners/${learner}/quiz-attempts`);
    assert.equal(wrongMethod.status, 405);
  }

  console.log('API contract test passed');
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  app.close();
  rmSync(workDir, { recursive: true, force: true });
}
