import { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import type {
  ApiResponse,
  FlashcardId,
  FlashcardRatingMutationDto,
  ImportProgressRequest,
  MissionId,
  MissionProgress,
  MissionProgressStatus,
  PortableProgressSnapshot,
  ProgressMutationDto,
  ProgressSnapshot,
  ProgressSnapshotDto,
  QuizAttempt,
  QuizAttemptMutationDto,
  RateFlashcardRequest,
  RecordQuizAttemptRequest,
  UpdateMissionProgressRequest,
} from '@ai-learning-adventure/types';
import { stepRank } from '@ai-learning-adventure/learner';
import {
  getPreviewSnapshot,
  isPreviewMode,
  setPreviewSnapshot,
} from '../../preview/previewMode.ts';
import {
  createIdempotencyKey,
  deleteJson,
  postJson,
  putJson,
  type ApiRequestError,
  type MutationFetcherOptions,
} from './client.ts';
import { apiKeys } from './keys.ts';

function projectMissionProgress(
  snapshot: ProgressSnapshot,
  missionId: MissionId,
  input: UpdateMissionProgressRequest,
): ProgressSnapshot {
  const existing = snapshot.missions[missionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  const furthestStep =
    existing && stepRank(existing.furthestStep) >= stepRank(input.furthestStep)
      ? existing.furthestStep
      : input.furthestStep;
  const status: MissionProgressStatus =
    input.completed === true
      ? 'completed'
      : existing?.status === 'completed'
        ? 'completed'
        : 'in_progress';
  const next: MissionProgress = {
    missionId,
    status,
    furthestStep,
    checkpointCompleted: (existing?.checkpointCompleted ?? false) || (input.checkpointCompleted ?? false),
    startedAt: existing?.startedAt ?? input.occurredAt,
    completedAt: input.completed === true ? input.occurredAt : existing?.completedAt,
  };
  return { ...snapshot, missions: { ...snapshot.missions, [missionId]: next } };
}

function projectFlashcardRating(
  snapshot: ProgressSnapshot,
  flashcardId: FlashcardId,
  input: RateFlashcardRequest,
): ProgressSnapshot {
  const existing = snapshot.flashcardRatings[flashcardId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  return {
    ...snapshot,
    flashcardRatings: {
      ...snapshot.flashcardRatings,
      [flashcardId]: {
        rating: input.rating,
        reviewCount: (existing?.reviewCount ?? 0) + 1,
        updatedAt: input.occurredAt,
      },
    },
  };
}

function useProgressCache(learnerId: string) {
  const { mutate } = useSWRConfig();
  const key = apiKeys.progress(learnerId);

  function project(update: (snapshot: ProgressSnapshot) => ProgressSnapshot): Promise<unknown> {
    return mutate(
      key,
      (current?: ApiResponse<ProgressSnapshotDto>) => {
        if (!current) return current;
        return { ...current, data: update(current.data) };
      },
      { revalidate: false },
    );
  }

  function settle(snapshot: ProgressSnapshotDto): Promise<unknown> {
    return mutate(key, { data: snapshot }, { revalidate: false });
  }

  function revalidate(): Promise<unknown> {
    return mutate(key);
  }

  return { project, settle, revalidate };
}

export interface UseUpdateMissionProgressResult {
  updateMissionProgress: (input: UpdateMissionProgressRequest) => Promise<ProgressMutationDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useUpdateMissionProgress(
  learnerId: string,
  missionId: MissionId,
): UseUpdateMissionProgressResult {
  const { project, settle, revalidate } = useProgressCache(learnerId);
  const route = apiKeys.missionProgress(learnerId, missionId);
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<ProgressMutationDto>,
    ApiRequestError,
    string,
    UpdateMissionProgressRequest
  >(route, (path: string, options: MutationFetcherOptions<UpdateMissionProgressRequest>) =>
    putJson<ProgressMutationDto, UpdateMissionProgressRequest>(path, options),
  );

  async function updateMissionProgress(input: UpdateMissionProgressRequest): Promise<ProgressMutationDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      if (current !== undefined) {
        const next = projectMissionProgress(current, missionId, input);
        setPreviewSnapshot(next);
        await project(() => next);
        return { snapshot: next, newlyEarnedAwards: [] };
      }
    }
    await project((snapshot) => projectMissionProgress(snapshot, missionId, input));
    try {
      const result = await trigger(input);
      await settle(result.data.snapshot);
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { updateMissionProgress, isMutating, error };
}

export interface UseRecordQuizAttemptResult {
  recordAttempt: (input: RecordQuizAttemptRequest) => Promise<QuizAttemptMutationDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useRecordQuizAttempt(learnerId: string): UseRecordQuizAttemptResult {
  const { settle, revalidate } = useProgressCache(learnerId);
  const route = apiKeys.quizAttempts(learnerId);
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<QuizAttemptMutationDto>,
    ApiRequestError,
    string,
    RecordQuizAttemptRequest
  >(route, (path: string, options: MutationFetcherOptions<RecordQuizAttemptRequest>) =>
    postJson<QuizAttemptMutationDto, RecordQuizAttemptRequest>(path, options),
  );

  async function recordAttempt(input: RecordQuizAttemptRequest): Promise<QuizAttemptMutationDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      const snapshot = current ?? ({
        learnerId,
        schemaVersion: 1,
        revision: input.attempt.completedAt,
        missions: {},
        attempts: [],
        flashcardRatings: {},
        earnedAwards: [],
      } as ProgressSnapshotDto);
      const attempt: QuizAttempt = {
        id: input.attempt.id,
        missionId: input.attempt.missionId,
        contentVersion: input.attempt.contentVersion,
        answers: [],
        scorePercent: 0,
        correctCount: 0,
        questionCount: 0,
        result: 'needs_review',
        weakTopics: [],
        startedAt: input.attempt.startedAt,
        completedAt: input.attempt.completedAt,
      };
      return { attempt, snapshot, newlyEarnedAwards: [] };
    }
    try {
      const result = await trigger(input);
      await settle(result.data.snapshot);
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { recordAttempt, isMutating, error };
}

export interface UseRateFlashcardResult {
  rateFlashcard: (input: RateFlashcardRequest) => Promise<FlashcardRatingMutationDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useRateFlashcard(learnerId: string, flashcardId: FlashcardId): UseRateFlashcardResult {
  const { project, revalidate } = useProgressCache(learnerId);
  const route = apiKeys.flashcardRating(learnerId, flashcardId);
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<FlashcardRatingMutationDto>,
    ApiRequestError,
    string,
    RateFlashcardRequest
  >(route, (path: string, options: MutationFetcherOptions<RateFlashcardRequest>) =>
    putJson<FlashcardRatingMutationDto, RateFlashcardRequest>(path, options),
  );

  async function rateFlashcard(input: RateFlashcardRequest): Promise<FlashcardRatingMutationDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      if (current !== undefined) {
        const next = projectFlashcardRating(current, flashcardId, input);
        setPreviewSnapshot(next);
        await project(() => next);
        const rating = next.flashcardRatings[flashcardId] /* nosemgrep: gitlab.eslint.detect-object-injection */!;
        return {
          flashcardId,
          rating: rating.rating,
          reviewCount: rating.reviewCount,
          updatedAt: rating.updatedAt,
          weakTopics: [],
        };
      }
    }
    await project((snapshot) => projectFlashcardRating(snapshot, flashcardId, input));
    try {
      const result = await trigger(input);
      await project((snapshot) => ({
        ...snapshot,
        flashcardRatings: {
          ...snapshot.flashcardRatings,
          [flashcardId]: {
            rating: result.data.rating,
            reviewCount: result.data.reviewCount,
            updatedAt: result.data.updatedAt,
          },
        },
      }));
      void revalidate();
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { rateFlashcard, isMutating, error };
}

export interface UseRateFlashcardAnyResult {
  rateFlashcard: (
    flashcardId: FlashcardId,
    input: RateFlashcardRequest,
  ) => Promise<FlashcardRatingMutationDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useRateFlashcardAny(learnerId: string): UseRateFlashcardAnyResult {
  const { project, revalidate } = useProgressCache(learnerId);
  const route = `${apiKeys.progress(learnerId)}/flashcard-rating`;
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<FlashcardRatingMutationDto>,
    ApiRequestError,
    string,
    { flashcardId: FlashcardId; input: RateFlashcardRequest }
  >(
    route,
    (path, options) =>
      putJson<FlashcardRatingMutationDto, RateFlashcardRequest>(
        apiKeys.flashcardRating(learnerId, options.arg.flashcardId),
        { arg: options.arg.input },
      ),
  );

  async function rateFlashcard(
    flashcardId: FlashcardId,
    input: RateFlashcardRequest,
  ): Promise<FlashcardRatingMutationDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      if (current !== undefined) {
        const next = projectFlashcardRating(current, flashcardId, input);
        setPreviewSnapshot(next);
        await project(() => next);
        const rating = next.flashcardRatings[flashcardId] /* nosemgrep: gitlab.eslint.detect-object-injection */!;
        return {
          flashcardId,
          rating: rating.rating,
          reviewCount: rating.reviewCount,
          updatedAt: rating.updatedAt,
          weakTopics: [],
        };
      }
    }
    await project((snapshot) => projectFlashcardRating(snapshot, flashcardId, input));
    try {
      const result = await trigger({ flashcardId, input });
      await project((snapshot) => ({
        ...snapshot,
        flashcardRatings: {
          ...snapshot.flashcardRatings,
          [flashcardId]: {
            rating: result.data.rating,
            reviewCount: result.data.reviewCount,
            updatedAt: result.data.updatedAt,
          },
        },
      }));
      void revalidate();
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { rateFlashcard, isMutating, error };
}

export interface UseImportProgressResult {
  importProgress: (snapshot: PortableProgressSnapshot) => Promise<ProgressSnapshotDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useImportProgress(learnerId: string): UseImportProgressResult {
  const { settle, revalidate } = useProgressCache(learnerId);
  const route = apiKeys.progressImport(learnerId);
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<ProgressSnapshotDto>,
    ApiRequestError,
    string,
    ImportProgressRequest
  >(route, (path: string, options: MutationFetcherOptions<ImportProgressRequest>) =>
    postJson<ProgressSnapshotDto, ImportProgressRequest>(path, options),
  );

  async function importProgress(snapshot: PortableProgressSnapshot): Promise<ProgressSnapshotDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      if (current !== undefined) return current;
    }
    try {
      const result = await trigger({ idempotencyKey: createIdempotencyKey(), snapshot, mode: 'replace' });
      await settle(result.data);
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { importProgress, isMutating, error };
}

export interface UseResetProgressResult {
  resetProgress: () => Promise<ProgressSnapshotDto>;
  isMutating: boolean;
  error?: ApiRequestError;
}

export function useResetProgress(learnerId: string): UseResetProgressResult {
  const { settle, revalidate } = useProgressCache(learnerId);
  const route = apiKeys.progress(learnerId);
  const { trigger, isMutating, error } = useSWRMutation<
    ApiResponse<ProgressSnapshotDto>,
    ApiRequestError,
    string,
    { idempotencyKey: string }
  >(route, (path: string, options: MutationFetcherOptions<{ idempotencyKey: string }>) =>
    deleteJson<ProgressSnapshotDto>(path, options),
  );

  async function resetProgress(): Promise<ProgressSnapshotDto> {
    if (isPreviewMode()) {
      const current = getPreviewSnapshot();
      if (current !== undefined) return current;
    }
    try {
      const result = await trigger({ idempotencyKey: createIdempotencyKey() });
      await settle(result.data);
      return result.data;
    } catch (err) {
      await revalidate();
      throw err;
    }
  }

  return { resetProgress, isMutating, error };
}
