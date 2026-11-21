import type {
  AwardId,
  FlashcardId,
  FlashcardRatingMutationDto,
  ImportProgressRequest,
  IsoDateTime,
  MissionId,
  MissionProgress as MissionProgressDto,
  MissionProgressStatus,
  MissionStep,
  ProgressMutationDto,
  ProgressProjection,
  ProgressSnapshot,
  ProgressSnapshotDto,
  QuestionId,
  QuestionOption,
  QuizAnswer,
  QuizAttempt as QuizAttemptDto,
  QuizAttemptMutationDto,
  QuizAttemptResult,
  RateFlashcardRequest,
  RecordQuizAttemptRequest,
  UpdateMissionProgressRequest,
} from '@ai-learning-adventure/types';
import type { AppDatabase, QueryClient } from '../db/client.ts';
import * as adminRepo from '../db/repositories/admin.repository.ts';
import * as contentRepo from '../db/repositories/content.repository.ts';
import * as progressRepo from '../db/repositories/progress.repository.ts';
import * as adminService from './admin.service.ts';
import type { Mission, QuizAttempt as QuizAttemptRow, QuizQuestion } from '../db/schema.ts';
import * as schema from '../db/schema.ts';
import { badRequest, conflict, notFound } from '../http/errors.ts';
import { toAwardDefinition } from './catalog.service.ts';

const MISSION_STEP_SEQUENCE: readonly MissionStep[] = [
  'lesson',
  'example',
  'checkpoint',
  'quiz',
  'result',
];

const OPERATION_UPDATE_MISSION_PROGRESS = 'updateMissionProgress';
const OPERATION_RECORD_QUIZ_ATTEMPT = 'recordQuizAttempt';
const OPERATION_RATE_FLASHCARD = 'rateFlashcard';
const OPERATION_IMPORT_PROGRESS = 'importProgress';
const OPERATION_RESET_PROGRESS = 'resetProgress';

function stepRank(step: MissionStep): number {
  return MISSION_STEP_SEQUENCE.indexOf(step);
}

function furthestOf(a: MissionStep, b: MissionStep): MissionStep {
  return stepRank(a) >= stepRank(b) ? a : b;
}

function nowIso(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

function toMissionProgressDto(row: schema.MissionProgress): MissionProgressDto {
  return {
    missionId: row.missionId as MissionId,
    status: row.status,
    furthestStep: row.furthestStep,
    checkpointCompleted: row.checkpointCompleted,
    ...(row.startedAt ? { startedAt: row.startedAt as IsoDateTime } : {}),
    ...(row.completedAt ? { completedAt: row.completedAt as IsoDateTime } : {}),
  };
}

function toQuizAttemptDto(row: QuizAttemptRow): QuizAttemptDto {
  return {
    id: row.id,
    missionId: row.missionId as MissionId,
    contentVersion: row.contentVersion,
    answers: JSON.parse(row.answersJson) as QuizAnswer[],
    scorePercent: row.scorePercent,
    correctCount: row.correctCount,
    questionCount: row.questionCount,
    result: row.result,
    weakTopics: JSON.parse(row.weakTopicsJson) as string[],
    startedAt: row.startedAt as IsoDateTime,
    completedAt: row.completedAt as IsoDateTime,
  };
}

export function buildSnapshot(
  db: QueryClient,
  learnerId: string,
  schemaVersion: number,
  revision: IsoDateTime,
): ProgressSnapshot {
  return {
    learnerId,
    schemaVersion,
    revision,
    missions: Object.fromEntries(
      progressRepo.listMissionProgress(db, learnerId).map((row) => [row.missionId, toMissionProgressDto(row)]),
    ),
    attempts: progressRepo.listQuizAttempts(db, learnerId).map(toQuizAttemptDto),
    flashcardRatings: Object.fromEntries(
      progressRepo.listFlashcardRatings(db, learnerId).map((row) => [
        row.flashcardId,
        { rating: row.rating, reviewCount: row.reviewCount, updatedAt: row.updatedAt as IsoDateTime },
      ]),
    ),
    earnedAwards: progressRepo.listEarnedAwards(db, learnerId).map((row) => ({
      awardId: row.awardId as AwardId,
      earnedAt: row.earnedAt as IsoDateTime,
    })),
  };
}

export function getProgressSnapshot(
  db: AppDatabase,
  learnerId: string,
  schemaVersion: number,
): ProgressSnapshotDto {
  const revision = nowIso();
  const learner = progressRepo.ensureLearner(db, learnerId, schemaVersion, revision);
  return buildSnapshot(db, learnerId, learner.schemaVersion, revision);
}

function replayIfDuplicate<T>(
  db: QueryClient,
  learnerId: string,
  idempotencyKey: string,
  operation: string,
): T | undefined {
  const record = progressRepo.getIdempotencyRecord(db, learnerId, idempotencyKey);
  if (!record) return undefined;
  if (record.operation !== operation) {
    throw conflict(
      'idempotency_conflict',
      `Idempotency key was already used for operation "${record.operation}".`,
    );
  }
  return JSON.parse(record.responseJson) as T;
}

function recordIdempotentResponse(
  db: QueryClient,
  learnerId: string,
  idempotencyKey: string,
  operation: string,
  response: unknown,
  now: IsoDateTime,
): void {
  progressRepo.insertIdempotencyRecord(db, {
    learnerId,
    idempotencyKey,
    operation,
    responseJson: JSON.stringify(response),
    createdAt: now,
  });
}

interface GradedAttempt {
  answers: QuizAnswer[];
  correctCount: number;
  questionCount: number;
  scorePercent: number;
  result: QuizAttemptResult;
  weakTopics: string[];
}

interface AttemptAnswerInput {
  questionId: string;
  selectedOptionIds: string[];
  reasoning?: string;
}

function gradeAttempt(
  answersInput: AttemptAnswerInput[],
  questions: QuizQuestion[],
  passThreshold: number,
): GradedAttempt {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const seenQuestionIds = new Set<string>();
  const answers: QuizAnswer[] = [];
  const weakTopics: string[] = [];
  let correctCount = 0;

  answersInput.forEach((answerInput, index) => {
    const question = questionsById.get(answerInput.questionId);
    if (!question) {
      throw badRequest(`Answer ${index} references unknown question "${answerInput.questionId}".`);
    }
    if (seenQuestionIds.has(question.id)) {
      throw badRequest(`Answer ${index} duplicates question "${question.id}".`);
    }
    seenQuestionIds.add(question.id);

    const options = JSON.parse(question.optionsJson) as QuestionOption[];
    const validOptionIds = new Set(options.map((option) => option.id));
    const selected = new Set<string>();
    for (const optionId of answerInput.selectedOptionIds) {
      if (!validOptionIds.has(optionId)) {
        throw badRequest(`Answer ${index} selects unknown option "${optionId}".`);
      }
      selected.add(optionId);
    }
    const correctOptionIds = options.filter((option) => option.isCorrect).map((option) => option.id);
    const isCorrect =
      correctOptionIds.length === selected.size && correctOptionIds.every((id) => selected.has(id));
    if (isCorrect) {
      correctCount += 1;
    }

    const conceptTags = JSON.parse(question.conceptTagsJson) as string[];
    if (!isCorrect) {
      for (const tag of conceptTags) {
        if (!weakTopics.includes(tag)) weakTopics.push(tag);
      }
    }
    const reasoningAllowed = question.allowsReasoning;
    const reasoning =
      reasoningAllowed && typeof answerInput.reasoning === 'string'
        ? answerInput.reasoning.trim().slice(0, 2000)
        : '';
    answers.push({
      questionId: question.id as QuestionId,
      selectedOptionIds: [...selected],
      ...(reasoning.length > 0 ? { reasoning } : {}),
      isCorrect,
      conceptTags,
    });
  });

  const questionCount = answers.length;
  const scorePercent = questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100);
  return {
    answers,
    correctCount,
    questionCount,
    scorePercent,
    result: scorePercent >= passThreshold ? 'passed' : 'needs_review',
    weakTopics,
  };
}

function evaluateAwards(
  db: QueryClient,
  learnerId: string,
  now: IsoDateTime,
  source: string,
): AwardId[] {
  const awardRows = contentRepo.listVisibleAwards(db);
  if (awardRows.length === 0) return [];

  const earnedIds = new Set(progressRepo.listEarnedAwards(db, learnerId).map((row) => row.awardId));
  const missions = contentRepo.listVisibleMissions(db);
  const progressRows = progressRepo.listMissionProgress(db, learnerId);
  const progressByMission = new Map(progressRows.map((row) => [row.missionId, row]));
  const attempts = progressRepo.listQuizAttempts(db, learnerId);

  const bestScoreByMission = new Map<string, number>();
  for (const attempt of attempts) {
    bestScoreByMission.set(
      attempt.missionId,
      Math.max(bestScoreByMission.get(attempt.missionId) ?? 0, attempt.scorePercent),
    );
  }

  const completedMissionIds = new Set(
    progressRows.filter((row) => row.status === 'completed').map((row) => row.missionId),
  );
  const completionPercent =
    missions.length === 0 ? 0 : Math.round((completedMissionIds.size / missions.length) * 100);

  let currentStreak = 0;
  let longestStreak = 0;
  for (const mission of missions) {
    if (completedMissionIds.has(mission.id)) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const isMissionCompleted = (missionId: string): boolean =>
    progressByMission.get(missionId)?.status === 'completed';

  const isTrackCompleted = (levelTrack: Mission['levelTrack']): boolean => {
    const trackMissions = missions.filter((mission) => mission.levelTrack === levelTrack);
    return trackMissions.length > 0 && trackMissions.every((mission) => completedMissionIds.has(mission.id));
  };

  const newlyEarned: AwardId[] = [];
  for (const award of awardRows) {
    if (earnedIds.has(award.id)) continue;
    let evidence: Record<string, unknown> | undefined;
    try {
      const rule = toAwardDefinition(award).rule;
      switch (rule.type) {
        case 'mission_completed':
          if (isMissionCompleted(rule.missionId)) {
            evidence = { missionId: rule.missionId };
          }
          break;
        case 'track_completed':
          if (isTrackCompleted(rule.levelTrack)) {
            evidence = { levelTrack: rule.levelTrack };
          }
          break;
        case 'score_threshold': {
          if (rule.missionId) {
            const best = bestScoreByMission.get(rule.missionId);
            if (best !== undefined && best >= rule.minScorePercent) {
              evidence = { missionId: rule.missionId, bestScorePercent: best, minScorePercent: rule.minScorePercent };
            }
          } else if (attempts.some((attempt) => attempt.scorePercent >= rule.minScorePercent)) {
            evidence = { minScorePercent: rule.minScorePercent };
          }
          break;
        }
        case 'streak':
          if (longestStreak >= rule.length) {
            evidence = { length: rule.length, longestStreak };
          }
          break;
        case 'percent_complete':
          if (completionPercent >= rule.minPercent) {
            evidence = { minPercent: rule.minPercent, completionPercent };
          }
          break;
      }
    } catch {
      evidence = undefined;
    }
    if (!evidence) continue;

    progressRepo.insertEarnedAward(db, {
      learnerId,
      awardId: award.id,
      earnedAt: now,
      sourceJson: JSON.stringify({ source, ruleType: award.ruleType, evidence }),
    });
    newlyEarned.push(award.id as AwardId);
  }
  return newlyEarned;
}

export function updateMissionProgress(
  db: AppDatabase,
  learnerId: string,
  missionId: string,
  input: UpdateMissionProgressRequest,
  schemaVersion: number,
): ProgressMutationDto {
  return db.transaction((tx) => {
    const replayed = replayIfDuplicate<ProgressMutationDto>(
      tx,
      learnerId,
      input.idempotencyKey,
      OPERATION_UPDATE_MISSION_PROGRESS,
    );
    if (replayed) return replayed;

    const mission = contentRepo.getVisibleMission(tx, missionId);
    if (!mission) throw notFound('Mission not found.');

    const now = input.occurredAt;
    const learner = progressRepo.ensureLearner(tx, learnerId, schemaVersion, now);
    const existing = progressRepo.getMissionProgress(tx, learnerId, missionId);
    const attempts = progressRepo.listQuizAttempts(tx, learnerId);
    const hasPassedAttempt = attempts.some(
      (attempt) => attempt.missionId === missionId && attempt.result === 'passed',
    );

    const furthestStep = existing ? furthestOf(existing.furthestStep, input.furthestStep) : input.furthestStep;
    const checkpointCompleted =
      (existing?.checkpointCompleted ?? false) || input.checkpointCompleted === true;
    const completed = checkpointCompleted && hasPassedAttempt;
    const status: MissionProgressStatus = completed ? 'completed' : 'in_progress';

    progressRepo.upsertMissionProgress(tx, {
      learnerId,
      missionId,
      status,
      furthestStep,
      checkpointCompleted,
      startedAt: existing?.startedAt ?? now,
      completedAt: existing?.completedAt ?? (completed ? now : null),
      updatedAt: now,
    });

    const newlyEarnedAwards = evaluateAwards(tx, learnerId, now, OPERATION_UPDATE_MISSION_PROGRESS);
    const response: ProgressMutationDto = {
      snapshot: buildSnapshot(tx, learnerId, learner.schemaVersion, now),
      newlyEarnedAwards,
    };
    recordIdempotentResponse(tx, learnerId, input.idempotencyKey, OPERATION_UPDATE_MISSION_PROGRESS, response, now);
    return response;
  });
}

export function recordQuizAttempt(
  db: AppDatabase,
  learnerId: string,
  input: RecordQuizAttemptRequest,
  schemaVersion: number,
): QuizAttemptMutationDto {
  return db.transaction((tx) => {
    const replayed = replayIfDuplicate<QuizAttemptMutationDto>(
      tx,
      learnerId,
      input.idempotencyKey,
      OPERATION_RECORD_QUIZ_ATTEMPT,
    );
    if (replayed) return replayed;

    const attemptInput = input.attempt;
    const mission = adminRepo.getMissionRow(tx, attemptInput.missionId);
    if (!mission) throw notFound('Mission not found.');

    const now = attemptInput.completedAt;
    const learner = progressRepo.ensureLearner(tx, learnerId, schemaVersion, now);

    const existingAttempt = progressRepo.getQuizAttempt(tx, attemptInput.id);
    if (existingAttempt) {
      if (existingAttempt.learnerId !== learnerId) {
        throw conflict('attempt_conflict', 'Quiz attempt id is already recorded for another learner.');
      }
      const response: QuizAttemptMutationDto = {
        attempt: toQuizAttemptDto(existingAttempt),
        snapshot: buildSnapshot(tx, learnerId, learner.schemaVersion, now),
        newlyEarnedAwards: [],
      };
      recordIdempotentResponse(tx, learnerId, input.idempotencyKey, OPERATION_RECORD_QUIZ_ATTEMPT, response, now);
      return response;
    }

    if (!Array.isArray(attemptInput.answers) || attemptInput.answers.length === 0) {
      throw badRequest('Field "attempt.answers" must be a non-empty array.');
    }

    const gradingSource = adminService.resolveGradingSource(tx, mission.id, attemptInput.contentVersion);
    if (gradingSource === undefined) {
      throw conflict(
        'content_version_mismatch',
        `Mission content version ${attemptInput.contentVersion} does not match current version ${mission.contentVersion}.`,
      );
    }
    const graded = gradeAttempt(
      attemptInput.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        reasoning: answer.reasoning,
      })),
      gradingSource.questions,
      gradingSource.passThreshold,
    );

    const attemptRow: schema.NewQuizAttempt = {
      id: attemptInput.id,
      learnerId,
      missionId: mission.id,
      contentVersion: attemptInput.contentVersion,
      answersJson: JSON.stringify(graded.answers),
      scorePercent: graded.scorePercent,
      correctCount: graded.correctCount,
      questionCount: graded.questionCount,
      result: graded.result,
      weakTopicsJson: JSON.stringify(graded.weakTopics),
      startedAt: attemptInput.startedAt,
      completedAt: attemptInput.completedAt,
    };
    progressRepo.insertQuizAttempt(tx, attemptRow);

    const existingProgress = progressRepo.getMissionProgress(tx, learnerId, mission.id);
    const checkpointCompleted = existingProgress?.checkpointCompleted ?? false;
    const completed =
      existingProgress?.status === 'completed' || (checkpointCompleted && graded.result === 'passed');
    progressRepo.upsertMissionProgress(tx, {
      learnerId,
      missionId: mission.id,
      status: completed ? 'completed' : 'in_progress',
      furthestStep: furthestOf(
        existingProgress?.furthestStep ?? 'lesson',
        graded.result === 'passed' ? 'result' : 'quiz',
      ),
      checkpointCompleted,
      startedAt: existingProgress?.startedAt ?? attemptInput.startedAt,
      completedAt: existingProgress?.completedAt ?? (completed ? attemptInput.completedAt : null),
      updatedAt: attemptInput.completedAt,
    });

    const newlyEarnedAwards = evaluateAwards(tx, learnerId, now, OPERATION_RECORD_QUIZ_ATTEMPT);
    const response: QuizAttemptMutationDto = {
      attempt: toQuizAttemptDto(attemptRow as QuizAttemptRow),
      snapshot: buildSnapshot(tx, learnerId, learner.schemaVersion, now),
      newlyEarnedAwards,
    };
    recordIdempotentResponse(tx, learnerId, input.idempotencyKey, OPERATION_RECORD_QUIZ_ATTEMPT, response, now);
    return response;
  });
}

export function computeWeakTopicInputs(
  db: QueryClient,
  learnerId: string,
): ProgressProjection['weakTopics'] {
  const attempts = progressRepo.listQuizAttempts(db, learnerId);
  const ratings = progressRepo.listFlashcardRatings(db, learnerId);

  const signals = new Map<string, { weight: number; sources: Set<string> }>();
  const addSignal = (topic: string, source: string): void => {
    const entry = signals.get(topic) ?? { weight: 0, sources: new Set<string>() };
    entry.weight += 1;
    entry.sources.add(source);
    signals.set(topic, entry);
  };

  for (const attempt of attempts) {
    const answers = JSON.parse(attempt.answersJson) as QuizAnswer[];
    for (const answer of answers) {
      if (answer.isCorrect) continue;
      for (const tag of answer.conceptTags) {
        addSignal(tag, `quiz:${attempt.missionId}`);
      }
    }
  }

  const needsWork = ratings.filter((rating) => rating.rating === 'needs_work');
  if (needsWork.length > 0) {
    const cards = contentRepo.getFlashcardsByIds(
      db,
      needsWork.map((rating) => rating.flashcardId),
    );
    const cardsById = new Map(cards.map((card) => [card.id, card]));
    for (const rating of needsWork) {
      const card = cardsById.get(rating.flashcardId);
      if (!card) continue;
      for (const tag of JSON.parse(card.conceptTagsJson) as string[]) {
        addSignal(tag, `flashcard:${card.id}`);
      }
    }
  }

  return [...signals.entries()]
    .map(([topic, entry]) => ({ topic, weight: entry.weight, sources: [...entry.sources].sort() }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}

export function rateFlashcard(
  db: AppDatabase,
  learnerId: string,
  flashcardId: string,
  input: RateFlashcardRequest,
  schemaVersion: number,
): FlashcardRatingMutationDto {
  return db.transaction((tx) => {
    const replayed = replayIfDuplicate<FlashcardRatingMutationDto>(
      tx,
      learnerId,
      input.idempotencyKey,
      OPERATION_RATE_FLASHCARD,
    );
    if (replayed) return replayed;

    const card = contentRepo.getVisibleFlashcard(tx, flashcardId);
    if (!card) throw notFound('Flashcard not found.');

    const now = input.occurredAt;
    progressRepo.ensureLearner(tx, learnerId, schemaVersion, now);
    const existing = progressRepo.getFlashcardRating(tx, learnerId, flashcardId);
    const reviewCount = (existing?.reviewCount ?? 0) + 1;

    progressRepo.upsertFlashcardRating(tx, {
      learnerId,
      flashcardId,
      rating: input.rating,
      reviewCount,
      updatedAt: now,
    });

    const response: FlashcardRatingMutationDto = {
      flashcardId: flashcardId as FlashcardId,
      rating: input.rating,
      reviewCount,
      updatedAt: now,
      weakTopics: computeWeakTopicInputs(tx, learnerId),
    };
    recordIdempotentResponse(tx, learnerId, input.idempotencyKey, OPERATION_RATE_FLASHCARD, response, now);
    return response;
  });
}

function requireIso(value: unknown, field: string): IsoDateTime {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw badRequest(`Field "${field}" must be an ISO-8601 date-time string.`);
  }
  return value as IsoDateTime;
}

export function importProgress(
  db: AppDatabase,
  learnerId: string,
  input: ImportProgressRequest,
  schemaVersion: number,
): ProgressSnapshotDto {
  return db.transaction((tx) => {
    const replayed = replayIfDuplicate<ProgressSnapshotDto>(
      tx,
      learnerId,
      input.idempotencyKey,
      OPERATION_IMPORT_PROGRESS,
    );
    if (replayed) return replayed;

    if (input.mode !== 'replace') {
      throw badRequest('Field "mode" must be "replace".');
    }
    const snapshot = input.snapshot;
    if (typeof snapshot !== 'object' || snapshot === null) {
      throw badRequest('Field "snapshot" must be an object.');
    }
    if (typeof snapshot.schemaVersion !== 'number') {
      throw badRequest('Field "snapshot.schemaVersion" must be a number.');
    }
    if (typeof snapshot.missions !== 'object' || snapshot.missions === null) {
      throw badRequest('Field "snapshot.missions" must be an object.');
    }
    if (!Array.isArray(snapshot.attempts)) {
      throw badRequest('Field "snapshot.attempts" must be an array.');
    }
    if (typeof snapshot.flashcardRatings !== 'object' || snapshot.flashcardRatings === null) {
      throw badRequest('Field "snapshot.flashcardRatings" must be an object.');
    }
    if (!Array.isArray(snapshot.earnedAwards)) {
      throw badRequest('Field "snapshot.earnedAwards" must be an array.');
    }

    const now = nowIso();
    const learner = progressRepo.ensureLearner(tx, learnerId, schemaVersion, now);

    const visibleMissions = contentRepo.listVisibleMissions(tx);
    const missionsById = new Map(visibleMissions.map((mission) => [mission.id, mission]));
    const visibleAwardIds = new Set(contentRepo.listVisibleAwards(tx).map((award) => award.id));

    progressRepo.deleteLearnerProgress(tx, learnerId);

    const missionStatuses: readonly MissionProgressStatus[] = ['not_started', 'in_progress', 'completed'];
    for (const [missionId, raw] of Object.entries(snapshot.missions)) {
      if (!missionsById.has(missionId)) continue;
      if (typeof raw !== 'object' || raw === null) {
        throw badRequest(`Imported mission progress for "${missionId}" must be an object.`);
      }
      const progress = raw as MissionProgressDto;
      if (!missionStatuses.includes(progress.status)) {
        throw badRequest(`Imported mission progress for "${missionId}" has invalid status.`);
      }
      if (!MISSION_STEP_SEQUENCE.includes(progress.furthestStep)) {
        throw badRequest(`Imported mission progress for "${missionId}" has invalid furthestStep.`);
      }
      progressRepo.upsertMissionProgress(tx, {
        learnerId,
        missionId,
        status: progress.status,
        furthestStep: progress.furthestStep,
        checkpointCompleted: progress.checkpointCompleted === true,
        startedAt: progress.startedAt ? requireIso(progress.startedAt, 'startedAt') : null,
        completedAt: progress.completedAt ? requireIso(progress.completedAt, 'completedAt') : null,
        updatedAt: now,
      });
    }

    const seenAttemptIds = new Set<string>();
    for (const rawAttempt of snapshot.attempts) {
      if (typeof rawAttempt !== 'object' || rawAttempt === null) {
        throw badRequest('Imported quiz attempts must be objects.');
      }
      const attempt = rawAttempt as QuizAttemptDto;
      if (typeof attempt.id !== 'string' || attempt.id.length === 0) {
        throw badRequest('Imported quiz attempts require a non-empty "id".');
      }
      if (seenAttemptIds.has(attempt.id)) continue;
      const mission = missionsById.get(attempt.missionId);
      if (!mission) continue;
      if (!Array.isArray(attempt.answers)) {
        throw badRequest(`Imported quiz attempt "${attempt.id}" requires an "answers" array.`);
      }
      seenAttemptIds.add(attempt.id);

      const gradingSource =
        adminService.resolveGradingSource(tx, mission.id, attempt.contentVersion) ??
        ({ passThreshold: mission.passThreshold, questions: contentRepo.listVisibleQuestions(tx, mission.id) } as {
          passThreshold: number;
          questions: QuizQuestion[];
        });
      const knownAnswers: AttemptAnswerInput[] = [];
      const questionIds = new Set(gradingSource.questions.map((question) => question.id));
      for (const answer of attempt.answers) {
        if (!questionIds.has(answer.questionId)) continue;
        knownAnswers.push({
          questionId: answer.questionId,
          selectedOptionIds: answer.selectedOptionIds ?? [],
          reasoning: answer.reasoning,
        });
      }
      if (knownAnswers.length === 0) continue;

      const graded = gradeAttempt(knownAnswers, gradingSource.questions, gradingSource.passThreshold);
      progressRepo.insertQuizAttemptIfAbsent(tx, {
        id: attempt.id,
        learnerId,
        missionId: mission.id,
        contentVersion: attempt.contentVersion,
        answersJson: JSON.stringify(graded.answers),
        scorePercent: graded.scorePercent,
        correctCount: graded.correctCount,
        questionCount: graded.questionCount,
        result: graded.result,
        weakTopicsJson: JSON.stringify(graded.weakTopics),
        startedAt: requireIso(attempt.startedAt, 'attempt.startedAt'),
        completedAt: requireIso(attempt.completedAt, 'attempt.completedAt'),
      });
    }

    for (const [flashcardId, raw] of Object.entries(snapshot.flashcardRatings)) {
      const card = contentRepo.getVisibleFlashcard(tx, flashcardId);
      if (!card) continue;
      if (typeof raw !== 'object' || raw === null) {
        throw badRequest(`Imported flashcard rating for "${flashcardId}" must be an object.`);
      }
      const rating = raw as { rating?: unknown; reviewCount?: unknown; updatedAt?: unknown };
      if (rating.rating !== 'got_it' && rating.rating !== 'needs_work') {
        throw badRequest(`Imported flashcard rating for "${flashcardId}" has invalid rating.`);
      }
      const reviewCount =
        typeof rating.reviewCount === 'number' && Number.isInteger(rating.reviewCount) && rating.reviewCount > 0
          ? rating.reviewCount
          : 1;
      progressRepo.upsertFlashcardRating(tx, {
        learnerId,
        flashcardId,
        rating: rating.rating,
        reviewCount,
        updatedAt: typeof rating.updatedAt === 'string' ? requireIso(rating.updatedAt, 'updatedAt') : now,
      });
    }

    for (const entry of snapshot.earnedAwards) {
      if (!visibleAwardIds.has(entry.awardId)) continue;
      progressRepo.insertEarnedAward(tx, {
        learnerId,
        awardId: entry.awardId,
        earnedAt: requireIso(entry.earnedAt, 'earnedAward.earnedAt'),
        sourceJson: JSON.stringify({ source: OPERATION_IMPORT_PROGRESS }),
      });
    }

    evaluateAwards(tx, learnerId, now, OPERATION_IMPORT_PROGRESS);

    const result = buildSnapshot(tx, learnerId, learner.schemaVersion, now);
    recordIdempotentResponse(tx, learnerId, input.idempotencyKey, OPERATION_IMPORT_PROGRESS, result, now);
    return result;
  });
}

export function resetProgress(
  db: AppDatabase,
  learnerId: string,
  idempotencyKey: string,
  schemaVersion: number,
): ProgressSnapshotDto {
  return db.transaction((tx) => {
    const replayed = replayIfDuplicate<ProgressSnapshotDto>(
      tx,
      learnerId,
      idempotencyKey,
      OPERATION_RESET_PROGRESS,
    );
    if (replayed) return replayed;

    const now = nowIso();
    const learner = progressRepo.ensureLearner(tx, learnerId, schemaVersion, now);
    progressRepo.deleteLearnerProgress(tx, learnerId);
    progressRepo.touchLearner(tx, learnerId, now);

    const result = buildSnapshot(tx, learnerId, learner.schemaVersion, now);
    recordIdempotentResponse(tx, learnerId, idempotencyKey, OPERATION_RESET_PROGRESS, result, now);
    return result;
  });
}
