import type { IncomingMessage } from 'node:http';
import type {
  AwardId,
  FlashcardRatingMutationDto,
  FlashcardRatingValue,
  ImportProgressRequest,
  MissionId,
  MissionStep,
  PortableProgressSnapshot,
  ProgressMutationDto,
  ProgressSnapshotDto,
  QuestionId,
  QuizAttemptAnswerInput,
  QuizAttemptMutationDto,
  RateFlashcardRequest,
  RecordQuizAttemptRequest,
  UpdateMissionProgressRequest,
} from '@ai-learning-adventure/types';
import type { ApiContext } from '../context.ts';
import { badRequest } from '../http/errors.ts';
import {
  optionalBoolean,
  readJsonBody,
  requireEnum,
  requireInteger,
  requireIsoDateTime,
  requireObject,
  requireString,
  requireStringArray,
} from '../http/response.ts';
import * as progressService from '../services/progress.service.ts';

const MISSION_STEPS: readonly MissionStep[] = ['lesson', 'example', 'checkpoint', 'quiz', 'result'];
const FLASHCARD_RATINGS: readonly FlashcardRatingValue[] = ['got_it', 'needs_work'];
const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

function requireIdempotencyKey(body: Record<string, unknown>): string {
  return requireString(body.idempotencyKey, 'idempotencyKey', IDEMPOTENCY_KEY_MAX_LENGTH);
}

export function handleGetProgress(ctx: ApiContext, learnerId: string): ProgressSnapshotDto {
  return progressService.getProgressSnapshot(ctx.dbHandle.db, learnerId, ctx.config.schemaVersion);
}

export async function handleUpdateMissionProgress(
  ctx: ApiContext,
  req: IncomingMessage,
  learnerId: string,
  missionId: string,
): Promise<ProgressMutationDto> {
  const body = await readJsonBody(req, ctx.config.bodyLimitBytes);
  const input: UpdateMissionProgressRequest = {
    idempotencyKey: requireIdempotencyKey(body),
    furthestStep: requireEnum(body.furthestStep, MISSION_STEPS, 'furthestStep'),
    checkpointCompleted: optionalBoolean(body.checkpointCompleted, 'checkpointCompleted'),
    completed: optionalBoolean(body.completed, 'completed'),
    occurredAt: requireIsoDateTime(body.occurredAt, 'occurredAt'),
  };
  return progressService.updateMissionProgress(
    ctx.dbHandle.db,
    learnerId,
    requireString(missionId, 'missionId', 128),
    input,
    ctx.config.schemaVersion,
  );
}

export async function handleRecordQuizAttempt(
  ctx: ApiContext,
  req: IncomingMessage,
  learnerId: string,
): Promise<QuizAttemptMutationDto> {
  const body = await readJsonBody(req, ctx.config.bodyLimitBytes);
  const attempt = requireObject(body.attempt, 'attempt');
  const rawAnswers = attempt.answers;
  if (!Array.isArray(rawAnswers)) {
    throw badRequest('Field "attempt.answers" must be an array.');
  }
  const answers: QuizAttemptAnswerInput[] = rawAnswers.map((raw, index) => {
    const answer = requireObject(raw, `attempt.answers[${index}]`);
    const parsed: QuizAttemptAnswerInput = {
      questionId: requireString(answer.questionId, `attempt.answers[${index}].questionId`, 128) as QuestionId,
      selectedOptionIds: requireStringArray(
        answer.selectedOptionIds,
        `attempt.answers[${index}].selectedOptionIds`,
      ),
    };
    if (answer.reasoning !== undefined) {
      parsed.reasoning = requireString(answer.reasoning, `attempt.answers[${index}].reasoning`, 2000);
    }
    return parsed;
  });

  const input: RecordQuizAttemptRequest = {
    idempotencyKey: requireIdempotencyKey(body),
    attempt: {
      id: requireString(attempt.id, 'attempt.id', 128),
      missionId: requireString(attempt.missionId, 'attempt.missionId', 128) as MissionId,
      contentVersion: requireInteger(attempt.contentVersion, 'attempt.contentVersion'),
      answers,
      startedAt: requireIsoDateTime(attempt.startedAt, 'attempt.startedAt'),
      completedAt: requireIsoDateTime(attempt.completedAt, 'attempt.completedAt'),
    },
    completionCandidate: optionalBoolean(body.completionCandidate, 'completionCandidate') ?? false,
    awardCandidateIds: requireStringArray(
      body.awardCandidateIds ?? [],
      'awardCandidateIds',
    ) as AwardId[],
  };
  return progressService.recordQuizAttempt(ctx.dbHandle.db, learnerId, input, ctx.config.schemaVersion);
}

export async function handleRateFlashcard(
  ctx: ApiContext,
  req: IncomingMessage,
  learnerId: string,
  flashcardId: string,
): Promise<FlashcardRatingMutationDto> {
  const body = await readJsonBody(req, ctx.config.bodyLimitBytes);
  const input: RateFlashcardRequest = {
    idempotencyKey: requireIdempotencyKey(body),
    rating: requireEnum(body.rating, FLASHCARD_RATINGS, 'rating'),
    occurredAt: requireIsoDateTime(body.occurredAt, 'occurredAt'),
  };
  return progressService.rateFlashcard(
    ctx.dbHandle.db,
    learnerId,
    requireString(flashcardId, 'flashcardId', 128),
    input,
    ctx.config.schemaVersion,
  );
}

export async function handleImportProgress(
  ctx: ApiContext,
  req: IncomingMessage,
  learnerId: string,
): Promise<ProgressSnapshotDto> {
  const body = await readJsonBody(req, ctx.config.bodyLimitBytes);
  const snapshot = requireObject(body.snapshot, 'snapshot') as unknown as PortableProgressSnapshot;
  const input: ImportProgressRequest = {
    idempotencyKey: requireIdempotencyKey(body),
    snapshot,
    mode: requireEnum(body.mode, ['replace'] as const, 'mode'),
  };
  return progressService.importProgress(ctx.dbHandle.db, learnerId, input, ctx.config.schemaVersion);
}

export async function handleResetProgress(
  ctx: ApiContext,
  req: IncomingMessage,
  learnerId: string,
): Promise<ProgressSnapshotDto> {
  const header = req.headers['idempotency-key'];
  if (typeof header !== 'string' || header.trim().length === 0 || header.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw badRequest('Header "Idempotency-Key" is required for progress reset.');
  }
  return progressService.resetProgress(
    ctx.dbHandle.db,
    learnerId,
    header.trim(),
    ctx.config.schemaVersion,
  );
}
