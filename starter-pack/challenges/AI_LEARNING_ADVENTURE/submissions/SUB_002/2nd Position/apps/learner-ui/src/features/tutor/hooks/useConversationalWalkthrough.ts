import { useCallback, useMemo, useState } from 'react';
import type {
  AiOnlyWalkthroughStep,
  CatalogDto,
  IsoDateTime,
  MissionDetail,
  ProgressSnapshotDto,
  QuizQuestion,
} from '@ai-learning-adventure/types';
import {
  AI_ONLY_WALKTHROUGH_STEPS,
  buildMissionStepContext,
  buildQuestionContext,
  gradeQuestion,
  nextAiOnlyWalkthroughStep,
  recommendNextMission,
  stepRank,
  walkthroughStepToMissionStep,
  type QuestionGrade,
} from '@ai-learning-adventure/learner';
import { useUpdateMissionProgress } from '../../../hooks/api/useProgressMutations.ts';
import { createIdempotencyKey } from '../../../hooks/api/client.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import { startMission } from '../../../store/missionSessionSlice.ts';
import {
  selectWalkthroughPosition,
  setWalkthroughPosition,
  type WalkthroughPosition,
} from '../../../store/aiSlice.ts';
import type { AiOnlySendOptions } from './useAiOnlySession.ts';

export interface WalkthroughQuizState {
  question: QuizQuestion;
  selectedOptionIds: string[];
  grade?: QuestionGrade;
}

export interface UseConversationalWalkthroughResult {
  position?: WalkthroughPosition;
  currentStep?: AiOnlyWalkthroughStep;
  stepNumber: number;
  totalSteps: number;
  active: boolean;
  complete: boolean;
  saving: boolean;
  progressNotice?: string;
  quiz?: WalkthroughQuizState;
  nextMission?: CatalogDto['missions'][number];
  start: () => void;
  next: () => Promise<void>;
  explainDifferently: () => Promise<void>;
  giveExample: () => Promise<void>;
  quizMe: () => void;
  selectQuizOption: (optionId: string) => void;
  submitQuizAnswer: () => void;
  explainQuizAnswer: () => Promise<void>;
  closeQuiz: () => void;
  takeFullQuiz: () => void;
  startNextMission: () => void;
}

function maxWalkthroughStep(
  a: AiOnlyWalkthroughStep,
  b: AiOnlyWalkthroughStep,
): AiOnlyWalkthroughStep {
  return AI_ONLY_WALKTHROUGH_STEPS.indexOf(a) >= AI_ONLY_WALKTHROUGH_STEPS.indexOf(b)
    ? a
    : b;
}

export function useConversationalWalkthrough(input: {
  learnerId: string;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  mission: MissionDetail;
  send: (message: string, options?: AiOnlySendOptions) => Promise<unknown>;
}): UseConversationalWalkthroughResult {
  const dispatch = useAppDispatch();
  const { navigate } = useAppNavigation();
  const position = useAppSelector(selectWalkthroughPosition(input.mission.id));
  const { updateMissionProgress, isMutating } = useUpdateMissionProgress(
    input.learnerId,
    input.mission.id,
  );
  const [progressNotice, setProgressNotice] = useState<string | undefined>(undefined);
  const [quiz, setQuiz] = useState<WalkthroughQuizState | undefined>(undefined);
  const nextMission = useMemo(
    () => recommendNextMission(input.catalog, input.progress, input.mission.id),
    [input.catalog, input.mission.id, input.progress],
  );

  const persistStep = useCallback(
    async (step: AiOnlyWalkthroughStep) => {
      const missionStep = walkthroughStepToMissionStep(step);
      const persisted = input.progress.missions[input.mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (
        persisted !== undefined &&
        stepRank(persisted.furthestStep) >= stepRank(missionStep)
      ) {
        return;
      }
      try {
        await updateMissionProgress({
          idempotencyKey: createIdempotencyKey(),
          furthestStep: missionStep,
          occurredAt: new Date().toISOString() as IsoDateTime,
        });
        setProgressNotice('Progress updated');
        announceLive('Progress updated for this mission.');
      } catch {
        setProgressNotice(undefined);
        announceLive('Walkthrough progress could not be saved.', 'assertive');
      }
    },
    [input.mission.id, input.progress.missions, updateMissionProgress],
  );

  const start = useCallback(() => {
    if (position?.status === 'active') return;
    dispatch(
      setWalkthroughPosition({
        missionId: input.mission.id,
        currentStep: 'objective',
        furthestStep: position?.furthestStep ?? 'objective',
        status: 'active',
      }),
    );
    setQuiz(undefined);
    announceLive(`Mission walkthrough started. Step 1 of ${AI_ONLY_WALKTHROUGH_STEPS.length}.`);
  }, [dispatch, input.mission.id, position]);

  const next = useCallback(async () => {
    if (position === undefined || isMutating) return;
    const nextStep = nextAiOnlyWalkthroughStep(position.currentStep);
    if (nextStep === undefined) {
      dispatch(
        setWalkthroughPosition({
          ...position,
          furthestStep: 'checkpoint',
          status: 'complete',
        }),
      );
      await persistStep('checkpoint');
      setQuiz(undefined);
      announceLive('Mission walkthrough complete. The checkpoint and full quiz remain to do.');
      return;
    }
    dispatch(
      setWalkthroughPosition({
        ...position,
        currentStep: nextStep,
        furthestStep: maxWalkthroughStep(position.furthestStep, nextStep),
        status: 'active',
      }),
    );
    setQuiz(undefined);
    await persistStep(nextStep);
  }, [dispatch, isMutating, persistStep, position]);

  const currentStep = position?.currentStep;
  const contextStep =
    currentStep !== undefined ? walkthroughStepToMissionStep(currentStep) : 'lesson';

  const explainDifferently = useCallback(async () => {
    if (currentStep === undefined) return;
    await input.send(`Explain the ${currentStep} step of ${input.mission.title} differently.`, {
      task: 'explain',
      context: buildMissionStepContext(input.mission, contextStep),
    });
  }, [contextStep, currentStep, input]);

  const giveExample = useCallback(async () => {
    if (currentStep === undefined) return;
    await input.send(`Give me another example for the ${currentStep} step.`, {
      task: 'example',
      context: buildMissionStepContext(input.mission, contextStep),
    });
  }, [contextStep, currentStep, input]);

  const quizMe = useCallback(() => {
    if (input.mission.questions.length === 0) return;
    const index = Math.max(0, AI_ONLY_WALKTHROUGH_STEPS.indexOf(currentStep ?? 'objective'));
    const question = input.mission.questions[index % input.mission.questions.length] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    if (question !== undefined) {
      setQuiz({ question, selectedOptionIds: [] });
      announceLive('Walkthrough question ready.');
    }
  }, [currentStep, input.mission.questions]);

  const takeFullQuiz = useCallback(() => {
    const checkpointComplete =
      input.progress.missions[input.mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.checkpointCompleted ?? false;
    const step = checkpointComplete ? 'quiz' : 'checkpoint';
    dispatch(
      startMission({
        missionId: input.mission.id,
        initialStep: step,
        startedAt: new Date().toISOString(),
      }),
    );
    navigate({ kind: 'mission', missionId: input.mission.id, step });
  }, [dispatch, input.mission.id, input.progress.missions, navigate]);

  const startNextMission = useCallback(() => {
    if (nextMission === undefined) return;
    dispatch(
      startMission({
        missionId: nextMission.id,
        initialStep: 'lesson',
        startedAt: new Date().toISOString(),
      }),
    );
    navigate({ kind: 'mission', missionId: nextMission.id, step: 'lesson' });
  }, [dispatch, navigate, nextMission]);

  return {
    ...(position !== undefined ? { position } : {}),
    ...(currentStep !== undefined ? { currentStep } : {}),
    stepNumber:
      currentStep === undefined ? 0 : AI_ONLY_WALKTHROUGH_STEPS.indexOf(currentStep) + 1,
    totalSteps: AI_ONLY_WALKTHROUGH_STEPS.length,
    active: position?.status === 'active',
    complete: position?.status === 'complete',
    saving: isMutating,
    ...(progressNotice !== undefined ? { progressNotice } : {}),
    ...(quiz !== undefined ? { quiz } : {}),
    ...(nextMission !== undefined ? { nextMission } : {}),
    start,
    next,
    explainDifferently,
    giveExample,
    quizMe,
    selectQuizOption: (optionId) => {
      setQuiz((current) => {
        if (current === undefined || current.grade !== undefined) return current;
        const selectedOptionIds =
          current.question.selectionMode === 'single'
            ? [optionId]
            : current.selectedOptionIds.includes(optionId)
              ? current.selectedOptionIds.filter((id) => id !== optionId)
              : [...current.selectedOptionIds, optionId];
        return { ...current, selectedOptionIds };
      });
    },
    submitQuizAnswer: () => {
      setQuiz((current) =>
        current === undefined || current.selectedOptionIds.length === 0
          ? current
          : {
              ...current,
              grade: gradeQuestion(current.question, current.selectedOptionIds),
            },
      );
    },
    explainQuizAnswer: async () => {
      if (quiz?.grade === undefined) return;
      const authoredExplanation = quiz.grade.isCorrect
        ? quiz.question.correctExplanation
        : quiz.question.incorrectExplanation;
      await input.send(
        quiz.grade.isCorrect ? 'Why is this answer right?' : 'Why was this answer wrong?',
        {
          task: 'answer_feedback',
          context: buildQuestionContext(input.mission, quiz.question),
          selectedOptionIds: quiz.selectedOptionIds,
          answerOutcome: quiz.grade.isCorrect ? 'correct' : 'incorrect',
          authoredExplanation,
          conceptTags: quiz.question.conceptTags,
          correctOptionTexts: quiz.question.options
            .filter((option) => option.isCorrect)
            .map((option) => option.text),
        },
      );
    },
    closeQuiz: () => setQuiz(undefined),
    takeFullQuiz,
    startNextMission,
  };
}
