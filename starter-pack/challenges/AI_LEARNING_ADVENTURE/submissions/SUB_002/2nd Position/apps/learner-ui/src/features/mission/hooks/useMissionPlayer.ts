import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  CatalogDto,
  IsoDateTime,
  MissionDetail,
  MissionStep,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import {
  clampStepToFurthest,
  furthestStepOf,
  hashStringSeed,
  isStepUnlocked,
  MISSION_STEP_LABELS,
  MISSION_STEP_SEQUENCE,
  nextStep,
  orderQuestionsForAttempt,
  previousStep,
  stepRank,
  type CheckpointEvaluation,
} from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  selectMissionSession,
  setMissionStep,
  startMission,
  submitCheckpointLocal,
} from '../../../store/missionSessionSlice.ts';
import {
  selectActiveQuiz,
  startQuiz as startQuizSession,
} from '../../../store/quizSessionSlice.ts';
import type { LearnerView } from '../../../store/navigationSlice.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useMission } from '../../../hooks/api/useMission.ts';
import { useUpdateMissionProgress } from '../../../hooks/api/useProgressMutations.ts';
import { createIdempotencyKey, type ApiRequestError } from '../../../hooks/api/client.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export type MissionView = Extract<LearnerView, { kind: 'mission' }>;

export interface UseMissionPlayerResult {
  mission?: MissionDetail;
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: () => void;
  step: MissionStep;
  furthestStep: MissionStep;
  visitedSteps: MissionStep[];
  canGoBack: boolean;
  canGoNext: boolean;
  checkpointComplete: boolean;
  isSaving: boolean;
  goBack: () => void;
  goNext: () => void;
  goToVisitedStep: (step: MissionStep) => void;
  completeCheckpoint: (evaluation: CheckpointEvaluation) => void;
  startQuiz: () => void;
}

function nowIso(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

export function useMissionPlayer(
  learnerId: string,
  view: MissionView,
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
): UseMissionPlayerResult {
  const dispatch = useAppDispatch();
  const { navigate, replace } = useAppNavigation();
  const missionId = view.missionId;

  const { mission, isLoading, error, refresh } = useMission(missionId);
  const session = useAppSelector(selectMissionSession(missionId));
  const activeQuiz = useAppSelector(selectActiveQuiz);
  const { updateMissionProgress, isMutating: isSaving } = useUpdateMissionProgress(
    learnerId,
    missionId,
  );
  const initialProgressRequested = useRef(false);

  const persisted = progress.missions[missionId];
  const persistedFurthest = persisted?.furthestStep ?? 'lesson';
  const checkpointComplete =
    (persisted?.checkpointCompleted ?? false) ||
    (session?.checkpointSubmission !== undefined && session.checkpointSubmission.outcome !== 'incorrect');

  const furthestStep = session !== undefined
    ? furthestStepOf(session.furthestStep, persistedFurthest)
    : persistedFurthest;

  const step = session !== undefined
    ? session.currentStep
    : clampStepToFurthest(view.step, persistedFurthest);

  const visitedSteps = session?.visitedSteps ?? [step];

  const persistFurthest = useCallback(
    (target: MissionStep, checkpointCompleted?: boolean) => {
      if (
        persisted !== undefined &&
        stepRank(target) <= stepRank(persistedFurthest) &&
        (checkpointCompleted !== true || (persisted?.checkpointCompleted ?? false))
      ) {
        return;
      }
      const request = {
        idempotencyKey: createIdempotencyKey(),
        furthestStep: target,
        occurredAt: nowIso(),
        ...(checkpointCompleted !== undefined ? { checkpointCompleted } : {}),
      };
      updateMissionProgress(request).catch(() => {
        announceLive('Your progress could not be saved. It will retry as you continue.', 'assertive');
      });
    },
    [persistedFurthest, persisted, updateMissionProgress],
  );

  useEffect(() => {
    const initialStep = session?.furthestStep ?? clampStepToFurthest(view.step, persistedFurthest);
    if (session === undefined) {
      dispatch(
        startMission({
          missionId,
          initialStep,
          startedAt: new Date().toISOString(),
        }),
      );
    }
    if (persisted === undefined && !initialProgressRequested.current) {
      initialProgressRequested.current = true;
      persistFurthest(initialStep);
    }
  }, [session, persisted, dispatch, missionId, view.step, persistedFurthest, persistFurthest]);

  const goToVisitedStep = useCallback(
    (target: MissionStep) => {
      if (!isStepUnlocked(target, furthestStep)) {
        announceLive('That step is not unlocked yet. Finish the earlier steps first.');
        return;
      }
      if (target === step) return;
      const touchedAt = new Date().toISOString();
      dispatch(setMissionStep({ missionId, step: target, touchedAt }));
      replace({ kind: 'mission', missionId, step: target });
      persistFurthest(target);
      announceLive(
        `Step ${MISSION_STEP_SEQUENCE.indexOf(target) + 1} of ${MISSION_STEP_SEQUENCE.length}: ${MISSION_STEP_LABELS[target] /* nosemgrep: gitlab.eslint.detect-object-injection */}`,
      );
    },
    [dispatch, replace, missionId, step, furthestStep, persistFurthest],
  );

  const startQuiz = useCallback(() => {
    if (!checkpointComplete) {
      announceLive('Complete the checkpoint to unlock the quiz.');
      return;
    }
    const touchedAt = new Date().toISOString();
    dispatch(setMissionStep({ missionId, step: 'quiz', touchedAt }));
    persistFurthest('quiz');
    if (activeQuiz !== undefined && activeQuiz.missionId === missionId && activeQuiz.status === 'in_progress') {
      navigate({ kind: 'quiz', missionId, attemptId: activeQuiz.attemptId });
      return;
    }
    if (mission === undefined) return;
    const attemptId = crypto.randomUUID();
    const hasPreviousAttempts = progress.attempts.some(
      (attempt) => attempt.missionId === missionId,
    );
    dispatch(
      startQuizSession({
        attemptId,
        missionId,
        contentVersion: mission.contentVersion,
        questionOrder: orderQuestionsForAttempt(mission.questions, attemptId, hasPreviousAttempts).map(
          (question) => question.id,
        ),
        ...(hasPreviousAttempts ? { optionShuffleSeed: hashStringSeed(attemptId) } : {}),
        startedAt: touchedAt,
      }),
    );
    navigate({ kind: 'quiz', missionId, attemptId });
  }, [checkpointComplete, dispatch, missionId, persistFurthest, activeQuiz, mission, navigate, progress.attempts]);

  const canGoNext = useMemo(() => {
    const target = nextStep(step);
    if (target === undefined) return false;
    if (step === 'quiz' || step === 'result') return false;
    if (step === 'checkpoint' && !checkpointComplete) return false;
    return true;
  }, [step, checkpointComplete]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    if (step === 'checkpoint') {
      startQuiz();
      return;
    }
    const target = nextStep(step);
    if (target === undefined) return;
    const touchedAt = new Date().toISOString();
    dispatch(setMissionStep({ missionId, step: target, touchedAt }));
    replace({ kind: 'mission', missionId, step: target });
    persistFurthest(target);
    announceLive(
      `Step ${MISSION_STEP_SEQUENCE.indexOf(target) + 1} of ${MISSION_STEP_SEQUENCE.length}: ${MISSION_STEP_LABELS[target]}`,
    );
  }, [canGoNext, step, startQuiz, dispatch, missionId, replace, persistFurthest]);

  const goBack = useCallback(() => {
    const target = previousStep(step);
    if (target === undefined) return;
    goToVisitedStep(target);
  }, [step, goToVisitedStep]);

  const completeCheckpoint = useCallback(
    (evaluation: CheckpointEvaluation) => {
      const submittedAt = new Date().toISOString();
      dispatch(
        submitCheckpointLocal({ missionId, outcome: evaluation.outcome, submittedAt }),
      );
      if (evaluation.countsTowardCompletion) {
        persistFurthest('checkpoint', true);
      }
    },
    [dispatch, missionId, persistFurthest],
  );

  return {
    ...(mission !== undefined ? { mission } : {}),
    isLoading,
    ...(error !== undefined ? { error } : {}),
    refresh: () => {
      void refresh();
    },
    step,
    furthestStep,
    visitedSteps,
    canGoBack: previousStep(step) !== undefined,
    canGoNext,
    checkpointComplete,
    isSaving,
    goBack,
    goNext,
    goToVisitedStep,
    completeCheckpoint,
    startQuiz,
  };
}
