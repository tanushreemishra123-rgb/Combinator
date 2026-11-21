import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AdminContentBundle,
  AdminContentItem,
  AdminContentListDto,
  AdminImportReport,
  AdminMissionDoc,
  AdminPublishResult,
  AdminQuestionDoc,
  AdminFlashcardDoc,
  AdminSeedStatusDto,
  AdminValidationReport,
  CatalogDto,
  MissionDetailDto,
  QuizAttemptMutationDto,
} from '@ai-learning-adventure/types';
import { createApp } from '../src/app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const workDir = mkdtempSync(join(tmpdir(), 'api-admin-'));

const app = createApp({
  host: '127.0.0.1',
  port: 0,
  databaseFile: join(workDir, 'admin.db'),
  missionDataDir: join(here, '..', 'mission-data'),
  corsOrigin: '*',
  bodyLimitBytes: 256 * 1024,
  schemaVersion: 1,
});

const server = createServer(app.handler);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address !== null && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;

interface CallResult<T> {
  status: number;
  body: T;
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  // Test requests are restricted to the ephemeral loopback server created above.
  // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf
  const res = await fetch(base + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) as T };
}

type Success<T> = { data: T };
type Failure = { error: { code: string; message: string } };

try {
  // Backfill: seeded content is present in the admin store.
  {
    const res = await call<Success<AdminContentListDto>>('GET', '/api/v1/admin/content?type=mission');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.items.length >= 8, 'seeded missions backfilled into admin store');
    const first = res.body.data.items[0]!;
    assert.equal(first.status, 'published');
    assert.equal(first.entityType, 'mission');
  }

  // Create a draft mission.
  let mission: AdminContentItem<AdminMissionDoc>;
  {
    const res = await call<Success<AdminContentItem<AdminMissionDoc>>>(
      'POST',
      '/api/v1/admin/content/mission',
      { slug: 'admin-test-mission' },
    );
    assert.equal(res.status, 200);
    mission = res.body.data;
    assert.equal(mission.status, 'draft');
    assert.equal(mission.doc.slug, '');
  }

  const missionId = mission.id;

  // Save the mission draft with full content.
  const missionDoc: AdminMissionDoc = {
    ...mission.doc,
    slug: 'admin-test-mission',
    title: 'Admin Test Mission',
    objective: 'Verify the admin publish pipeline.',
    lesson: [{ type: 'paragraph', text: 'A lesson paragraph.' }],
    example: { type: 'scenario', narrative: 'Narrative.', reflectionPrompt: 'Prompt?', takeaway: 'Takeaway.' },
    checkpoint: {
      kind: 'single_question',
      prompt: 'Pick one',
      options: [
        { id: 'a', text: 'A', isCorrect: true },
        { id: 'b', text: 'B', isCorrect: false },
      ],
      explanation: 'Because A.',
    },
    estimatedMinutes: 5,
    passThreshold: 50,
  };
  {
    const res = await call<Success<AdminContentItem<AdminMissionDoc>>>(
      'PUT',
      `/api/v1/admin/content/mission/${missionId}`,
      { doc: missionDoc, expectedRevision: mission.revision },
    );
    assert.equal(res.status, 200);
    mission = res.body.data;
    assert.equal(mission.revision, 2);
  }

  // Revision conflict is rejected.
  {
    const res = await call<Failure>('PUT', `/api/v1/admin/content/mission/${missionId}`, {
      doc: missionDoc,
      expectedRevision: 1,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'revision_mismatch');
  }

  // Helper to create + save a question draft assigned to the mission.
  async function createQuestion(stem: string, order: number): Promise<AdminContentItem<AdminQuestionDoc>> {
    const created = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'POST',
      '/api/v1/admin/content/question',
      {},
    );
    assert.equal(created.status, 200);
    const item = created.body.data;
    const doc: AdminQuestionDoc = {
      ...item.doc,
      missionId,
      stem,
      options: [
        { id: 'a', text: 'Correct', isCorrect: true },
        { id: 'b', text: 'Wrong', isCorrect: false },
      ],
      correctExplanation: 'Right because.',
      incorrectExplanation: 'Wrong because.',
      conceptTags: ['admin-test'],
      displayOrder: order,
    };
    const saved = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'PUT',
      `/api/v1/admin/content/question/${item.id}`,
      { doc, expectedRevision: item.revision },
    );
    assert.equal(saved.status, 200);
    return saved.body.data;
  }

  async function createFlashcard(concept: string, order: number): Promise<AdminContentItem<AdminFlashcardDoc>> {
    const created = await call<Success<AdminContentItem<AdminFlashcardDoc>>>(
      'POST',
      '/api/v1/admin/content/flashcard',
      {},
    );
    assert.equal(created.status, 200);
    const item = created.body.data;
    const doc: AdminFlashcardDoc = {
      ...item.doc,
      missionId,
      concept,
      definition: 'A definition.',
      example: 'An example.',
      learningTip: 'A tip.',
      conceptTags: ['admin-test'],
      displayOrder: order,
    };
    const saved = await call<Success<AdminContentItem<AdminFlashcardDoc>>>(
      'PUT',
      `/api/v1/admin/content/flashcard/${item.id}`,
      { doc, expectedRevision: item.revision },
    );
    assert.equal(saved.status, 200);
    return saved.body.data;
  }

  const questions: Array<AdminContentItem<AdminQuestionDoc>> = [];
  for (let index = 1; index <= 5; index += 1) {
    questions.push(await createQuestion(`Question ${index}`, index));
  }
  const flashcards: Array<AdminContentItem<AdminFlashcardDoc>> = [];
  for (let index = 1; index <= 3; index += 1) {
    flashcards.push(await createFlashcard(`Concept ${index}`, index));
  }

  // Validation report: mission bundle is valid (5 questions, 3 flashcards).
  {
    const res = await call<Success<AdminValidationReport>>(
      'GET',
      `/api/v1/admin/content/mission/${missionId}/validation`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.blockingCount, 0, JSON.stringify(res.body.data.issues));
  }

  // Publish gate: missing acknowledgement is rejected.
  {
    const res = await call<Failure>('POST', `/api/v1/admin/content/mission/${missionId}/publish`, {
      acknowledgement: false,
      expectedRevision: mission.revision,
    });
    assert.equal(res.status, 400);
  }

  // Publish gate: blocking issues block publish. Remove a correct flag to create a blocker.
  {
    const q = questions[0]!;
    const brokenDoc: AdminQuestionDoc = {
      ...q.doc,
      options: q.doc.options.map((option) => ({ ...option, isCorrect: false })),
    };
    const saved = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'PUT',
      `/api/v1/admin/content/question/${q.id}`,
      { doc: brokenDoc, expectedRevision: q.revision, lenient: true },
    );
    assert.equal(saved.status, 200);

    const res = await call<Failure>('POST', `/api/v1/admin/content/mission/${missionId}/publish`, {
      acknowledgement: true,
      expectedRevision: mission.revision,
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'validation_failed');

    const fixedDoc: AdminQuestionDoc = {
      ...q.doc,
      options: q.doc.options.map((option) => ({ ...option, isCorrect: option.id === 'a' })),
    };
    const restored = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'PUT',
      `/api/v1/admin/content/question/${q.id}`,
      { doc: fixedDoc, expectedRevision: saved.body.data.revision },
    );
    assert.equal(restored.status, 200);
    questions[0] = restored.body.data;
  }

  // Publish the mission including dependent drafts.
  {
    const res = await call<Success<AdminPublishResult>>('POST', `/api/v1/admin/content/mission/${missionId}/publish`, {
      acknowledgement: true,
      note: 'Initial publish',
      expectedRevision: mission.revision,
      includeDependentDrafts: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.item.status, 'published');
    assert.equal(res.body.data.publishedDependentIds.length, 8, '5 questions + 3 flashcards published');
    mission = res.body.data.item as AdminContentItem<AdminMissionDoc>;
  }

  // Learner catalog now includes the new mission.
  {
    const res = await call<Success<CatalogDto>>('GET', '/api/v1/catalog');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.missions.some((entry) => entry.id === missionId));
  }

  // Learner mission detail resolves the published content.
  let publishedContentVersion: number;
  {
    const res = await call<Success<MissionDetailDto>>('GET', `/api/v1/missions/${missionId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.mission.questions.length, 5);
    assert.equal(res.body.data.mission.flashcards.length, 3);
    publishedContentVersion = res.body.data.mission.contentVersion;
  }

  // Learner starts a quiz at the published version.
  const learner = 'learner-admin-1';
  const attemptBase = {
    missionId,
    contentVersion: publishedContentVersion,
    startedAt: '2026-08-13T09:00:00.000Z',
    completedAt: '2026-08-13T09:05:00.000Z',
  };

  // Publish a change to a question while the attempt is in flight.
  {
    const q = questions[1]!;
    const changed: AdminQuestionDoc = { ...q.doc, stem: `${q.doc.stem} (edited)` };
    const saved = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'PUT',
      `/api/v1/admin/content/question/${q.id}`,
      { doc: changed, expectedRevision: q.revision },
    );
    assert.equal(saved.status, 200);
    const published = await call<Success<AdminPublishResult>>(
      'POST',
      `/api/v1/admin/content/question/${q.id}/publish`,
      { acknowledgement: true, expectedRevision: saved.body.data.revision },
    );
    assert.equal(published.status, 200);
  }

  // The in-flight attempt still grades against the original snapshot.
  {
    const detail = await call<Success<MissionDetailDto>>('GET', `/api/v1/missions/${missionId}`);
    assert.ok(
      detail.body.data.mission.contentVersion > publishedContentVersion,
      'republish bumped the mission content version',
    );
    const answers = questions.map((question) => ({
      questionId: question.id,
      selectedOptionIds: ['a'],
    }));
    const res = await call<Success<QuizAttemptMutationDto>>(
      'POST',
      `/api/v1/learners/${learner}/quiz-attempts`,
      {
        idempotencyKey: 'admin-attempt-1',
        attempt: { id: 'attempt-admin-1', ...attemptBase, answers },
        completionCandidate: true,
        awardCandidateIds: [],
      },
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.attempt.scorePercent, 100, 'graded against the snapshot the learner started with');
    assert.equal(res.body.data.attempt.contentVersion, publishedContentVersion);
  }

  // Disable the mission -> hidden from learners immediately.
  {
    const res = await call<Success<AdminContentItem>>('PATCH', `/api/v1/admin/content/mission/${missionId}/enabled`, {
      enabled: false,
    });
    assert.equal(res.status, 200);
    const catalog = await call<Success<CatalogDto>>('GET', '/api/v1/catalog');
    assert.ok(!catalog.body.data.missions.some((entry) => entry.id === missionId));
  }

  // Re-enable -> visible again.
  {
    const res = await call<Success<AdminContentItem>>('PATCH', `/api/v1/admin/content/mission/${missionId}/enabled`, {
      enabled: true,
    });
    assert.equal(res.status, 200);
    const catalog = await call<Success<CatalogDto>>('GET', '/api/v1/catalog');
    assert.ok(catalog.body.data.missions.some((entry) => entry.id === missionId));
  }

  // Practice assignments: unassign a question, then reassign it at index 0.
  {
    const q = questions[4]!;
    const unassign = await call<Success<{ items: AdminContentItem[] }>>('PATCH', '/api/v1/admin/practice-assignments', {
      changes: [{ entityType: 'question', id: q.id, missionId: null, index: 0 }],
    });
    assert.equal(unassign.status, 200);
    const afterUnassign = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'GET',
      `/api/v1/admin/content/question/${q.id}`,
    );
    assert.equal(afterUnassign.body.data.doc.missionId, null);

    const reassign = await call<Success<{ items: AdminContentItem[] }>>('PATCH', '/api/v1/admin/practice-assignments', {
      changes: [{ entityType: 'question', id: q.id, missionId, index: 0 }],
    });
    assert.equal(reassign.status, 200);
    const afterReassign = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'GET',
      `/api/v1/admin/content/question/${q.id}`,
    );
    assert.equal(afterReassign.body.data.doc.missionId, missionId);
    assert.equal(afterReassign.body.data.doc.displayOrder, 1, 'reassigned to the first position');
  }

  // Cross-mission reassignment: republishing the moved question bumps the source mission too.
  {
    const catalogNow = await call<Success<CatalogDto>>('GET', '/api/v1/catalog');
    const seeded = catalogNow.body.data.missions.find((entry) => entry.id !== missionId);
    assert.ok(seeded !== undefined, 'a seeded mission exists');
    const seededId = seeded!.id;
    const before = await call<Success<MissionDetailDto>>('GET', `/api/v1/missions/${seededId}`);
    const q = questions[2]!;
    const move = await call<Success<{ items: AdminContentItem[] }>>('PATCH', '/api/v1/admin/practice-assignments', {
      changes: [{ entityType: 'question', id: q.id, missionId: seededId, index: 0 }],
    });
    assert.equal(move.status, 200);
    const movedItem = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'GET',
      `/api/v1/admin/content/question/${q.id}`,
    );
    const publish = await call<Success<AdminPublishResult>>(
      'POST',
      `/api/v1/admin/content/question/${q.id}/publish`,
      { acknowledgement: true, expectedRevision: movedItem.body.data.revision },
    );
    assert.equal(publish.status, 200);
    const after = await call<Success<MissionDetailDto>>('GET', `/api/v1/missions/${seededId}`);
    assert.ok(
      after.body.data.mission.contentVersion > before.body.data.mission.contentVersion,
      'source mission version bumped when a published question leaves it',
    );

    // Move it back so later steps keep a 5-question bundle.
    const back = await call<Success<{ items: AdminContentItem[] }>>('PATCH', '/api/v1/admin/practice-assignments', {
      changes: [{ entityType: 'question', id: q.id, missionId, index: 4 }],
    });
    assert.equal(back.status, 200);
    const backItem = await call<Success<AdminContentItem<AdminQuestionDoc>>>(
      'GET',
      `/api/v1/admin/content/question/${q.id}`,
    );
    const backPublish = await call<Success<AdminPublishResult>>(
      'POST',
      `/api/v1/admin/content/question/${q.id}/publish`,
      { acknowledgement: true, expectedRevision: backItem.body.data.revision },
    );
    assert.equal(backPublish.status, 200);
  }

  // Export bundle contains the mission.
  {
    const res = await call<Success<AdminContentBundle>>('GET', '/api/v1/admin/content/export');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.missions.some((entry) => entry.id === missionId));
    assert.equal(res.body.data.bundleVersion, 1);
  }

  // Import dry run reports counts without applying.
  {
    const bundle: AdminContentBundle = {
      bundleVersion: 1,
      missions: [],
      questions: [],
      flashcards: [
        {
          id: 'flashcard-import-1',
          missionId,
          concept: 'Imported concept',
          definition: 'Imported definition.',
          example: 'Imported example.',
          learningTip: 'Imported tip.',
          conceptTags: ['import'],
          difficulty: 'beginner',
          displayOrder: 99,
        },
      ],
      awards: [],
    };
    const dry = await call<Success<AdminImportReport>>('POST', '/api/v1/admin/content/import', {
      bundle,
      mode: 'merge',
      dryRun: true,
    });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.data.dryRun, true);
    assert.equal(dry.body.data.applied, false);
    assert.equal(dry.body.data.perType.flashcard.added, 1);

    const apply = await call<Success<AdminImportReport>>('POST', '/api/v1/admin/content/import', {
      bundle,
      mode: 'merge',
      dryRun: false,
    });
    assert.equal(apply.status, 200);
    assert.equal(apply.body.data.applied, true);

    const imported = await call<Success<AdminContentItem>>('GET', '/api/v1/admin/content/flashcard/flashcard-import-1');
    assert.equal(imported.status, 200);
    assert.equal(imported.body.data.status, 'draft', 'imported content is forced to draft');
  }

  // Seed status reports integrity rows.
  {
    const res = await call<Success<AdminSeedStatusDto>>('GET', '/api/v1/admin/seed');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.counts.missions >= 8);
    assert.ok(res.body.data.integrity.length >= 8);
    const seededRow = res.body.data.integrity.find((row) => row.missionId === 'mission-ai-basics');
    assert.ok(seededRow !== undefined);
    assert.ok(seededRow!.checks.every((check) => check.ok), 'seeded mission passes integrity checks');
  }

  // Preview session round-trip.
  {
    const created = await call<Success<{ token: string }>>('POST', '/api/v1/admin/preview', { missionId });
    assert.equal(created.status, 200);
    const token = created.body.data.token;
    const payload = await call<Success<{ catalog: CatalogDto; mission: MissionDetailDto['mission'] }>>(
      'GET',
      `/api/v1/preview/${token}`,
    );
    assert.equal(payload.status, 200);
    assert.equal(payload.body.data.mission.id, missionId);
    assert.equal(payload.body.data.mission.questions.length, 5);
  }

  // Publish history records the trail.
  {
    const res = await call<Success<Array<{ action: string }>>>(
      'GET',
      `/api/v1/admin/content/mission/${missionId}/history`,
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((entry) => entry.action === 'publish'));
  }

  console.log('Admin contract test passed');
} finally {
  server.close();
  app.close();
  rmSync(workDir, { recursive: true, force: true });
}
