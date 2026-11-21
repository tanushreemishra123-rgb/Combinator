import { useCallback, useEffect, useMemo } from 'react';
import type {
  IsoDateTime,
  MissionDetail,
  ProgressSnapshotDto,
  QuestionId,
  QuizQuestion,
} from '@ai-learning-adventure/types';
import {
  buildQuizAttempt,
  buildQuizAttemptInput,
  gradeQuestion,
  hashStringSeed,
  optionsForQuestion,
  orderQuestionsForAttempt,
  type QuizAnswerSubmission,
} from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  clearQuiz,
  finalizeLocalAttempt,
  nextQuestion as nextQuestionAction,
  openAnsweredQuestion as openAnsweredQuestionAction,
  selectActiveQuiz,
  selectCurrentQuestionId,
  selectCurrentSelection,
  selectQuizAnswer,
  selectQuizCanSubmit,
  selectOptions as selectOptionsAction,
  setReasoningDraft,
  startQuiz as startQuizAction,
  submitLocalAnswer,
  type FinalizedQuizSummary,
  type QuizAnswerSubmission as LocalQuizAnswerSubmission,
  type QuizSessionStatus,
} from '../../../store/quizSessionSlice.ts';
import type { LearnerView } from '../../../store/navigationSlice.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useMission } from '../../../hooks/api/useMission.ts';
import { useRecordQuizAttempt } from '../../../hooks/api/useProgressMutations.ts';
import { createIdempotencyKey, type ApiRequestError } from '../../../hooks/api/client.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export type { QuizSessionStatus };

export type QuizViewType = Extract<LearnerView, { kind: 'quiz' }>;

function nowIso(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

export interface UseQuizSessionResult {
  mission?: MissionDetail;
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: () => void;
  attemptId?: string;
  status?: QuizSessionStatus;
  question?: QuizQuestion;
  questionNumber: number;
  questionCount: number;
  questionOrder: QuestionId[];
  answeredCount: number;
  answeredQuestionIds: QuestionId[];
  canSubmit: boolean;
  canGoNext: boolean;
  isLast: boolean;
  selection: string[];
  submission?: LocalQuizAnswerSubmission;
  reasoningDraft: string;
  isSaving: boolean;
  saveError?: ApiRequestError;
  summary?: FinalizedQuizSummary;
  selectOptions: (optionIds: string[]) => void;
  setReasoning: (reasoning: string) => void;
  submit: () => void;
  next: () => void;
  openAnsweredQuestion: (questionId: QuestionId) => void;
  exit: () => void;
  retryQuiz: () => void;
  retrySave: () => void;
}

export function useQuizSession(
  learnerId: string,
  view: QuizViewType,
  progress: ProgressSnapshotDto,
): UseQuizSessionResult {
  const dispatch = useAppDispatch();
  const { replace } = useAppNavigation();
  const missionId = view.missionId;
  const { mission, isLoading, error, refresh } = useMission(missionId);

  const active = useAppSelector(selectActiveQuiz);
  const activeMatchesMission = active !== undefined && active.missionId === missionId;
  const hasPreviousAttempts = useMemo(
    () => progress.attempts.some((attempt) => attempt.missionId === missionId),
    [progress.attempts, missionId],
  );

  useEffect(() => {
    if (activeMatchesMission || mission === undefined) return;
    const attemptId = crypto.randomUUID();
    dispatch(
      startQuizAction({
        attemptId,
        missionId,
        contentVersion: mission.contentVersion,
        questionOrder: orderQuestionsForAttempt(mission.questions, attemptId, hasPreviousAttempts).map(
          (question) => question.id,
        ),
        ...(hasPreviousAttempts ? { optionShuffleSeed: hashStringSeed(attemptId) } : {}),
        startedAt: nowIso(),
      }),
    );
    replace({ kind: 'quiz', missionId, attemptId });
  }, [activeMatchesMission, mission, hasPreviousAttempts, dispatch, replace, missionId]);

  const currentQuestionId = useAppSelector(selectCurrentQuestionId);
  const selection = useAppSelector(selectCurrentSelection);
  const canSubmit = useAppSelector(selectQuizCanSubmit);
  const currentAnswer = useAppSelector(selectQuizAnswer(currentQuestionId ?? ('' as QuestionId)));

  const progressModel = useMemo(() => {
    if (active === undefined) return undefined;
    const total = active.questionOrder.length;
    const answered = Object.values(active.answers).filter(
      (answer) => answer.submission !== undefined,
    ).length;
    return {
      total,
      answered,
      currentIndex: active.currentIndex,
      isLast: active.currentIndex === total - 1,
    };
  }, [active]);

  const question = useMemo(() => {
    if (mission === undefined || currentQuestionId === undefined) return undefined;
    const base = mission.questions.find((candidate) => candidate.id === currentQuestionId);
    if (base === undefined) return undefined;
    if (active === undefined) return base;
    return {
      ...base,
      options: optionsForQuestion(base, active.attemptId, active.optionShuffleSeed),
    };
  }, [mission, currentQuestionId, active]);

  const { recordAttempt, isMutating: isSaving, error: saveError } = useRecordQuizAttempt(learnerId);

  const selectOptions = useCallback(
    (optionIds: string[]) => {
      const current = currentQuestionId;
      if (current === undefined || active === undefined || active.status !== 'in_progress') return;
      const answer = active.answers[current];
      if (!answer || answer.submission !== undefined || question === undefined) return;
      let nextOptionIds = optionIds;
      if (question.selectionMode === 'single' && nextOptionIds.length > 1) {
        nextOptionIds = nextOptionIds.slice(-1);
      }
      dispatch(selectOptionsAction({ questionId: current, optionIds: nextOptionIds }));
    },
    [dispatch, currentQuestionId, active, question],
  );

  const setReasoning = useCallback(
    (reasoning: string) => {
      const current = currentQuestionId;
      if (current === undefined) return;
      dispatch(setReasoningDraft({ questionId: current, reasoning }));
    },
    [dispatch, currentQuestionId],
  );

  const submit = useCallback(() => {
    const current = currentQuestionId;
    if (current === undefined || question === undefined) return;
    if (!canSubmit) return;
    const grade = gradeQuestion(question, selection);
    dispatch(
      submitLocalAnswer({
        questionId: current,
        isCorrect: grade.isCorrect,
        submittedAt: nowIso(),
      }),
    );
    announceLive(grade.isCorrect ? 'Correct! Here is why that is right.' : 'Not quite. Here is why.');
  }, [dispatch, currentQuestionId, question, canSubmit, selection]);

  const persistAttempt = useCallback(
    (attempt: ReturnType<typeof buildQuizAttempt>, submissions: QuizAnswerSubmission[]) => {
      recordAttempt({
        idempotencyKey: createIdempotencyKey(),
        attempt: buildQuizAttemptInput({
          attemptId: attempt.id,
          missionId: attempt.missionId,
          contentVersion: attempt.contentVersion,
          submissions,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
        }),
        completionCandidate: attempt.result === 'passed',
        awardCandidateIds:
          attempt.result === 'passed'
            ? (mission?.awards ?? []).map((award) => award.id)
            : [],
      }).catch(() => {
        announceLive('The quiz result could not be saved. Use Try again to save it.', 'assertive');
      });
    },
    [recordAttempt, mission],
  );

  const finalize = useCallback(() => {
    if (active === undefined || active.status !== 'in_progress' || mission === undefined) return;
    const submissions = active.questionOrder.map((questionId) => {
      const answer = active.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (answer?.submission === undefined) {
        throw new Error('Cannot finalize a quiz with unanswered questions.');
      }
      return {
        questionId,
        selectedOptionIds: answer.submission.selectedOptionIds,
        ...(answer.submission.reasoning !== undefined
          ? { reasoning: answer.submission.reasoning }
          : {}),
      };
    });
    const completedAt = nowIso();
    const attempt = buildQuizAttempt({
      attemptId: active.attemptId,
      missionId: active.missionId,
      contentVersion: active.contentVersion,
      questions: mission.questions,
      submissions,
      passThreshold: mission.passThreshold,
      startedAt: active.startedAt as IsoDateTime,
      completedAt,
    });
    dispatch(
      finalizeLocalAttempt({
        scorePercent: attempt.scorePercent,
        correctCount: attempt.correctCount,
        result: attempt.result,
        weakTopics: attempt.weakTopics,
        completedAt,
      }),
    );
    announceLive(
      attempt.result === 'passed'
        ? `Quiz passed with ${attempt.scorePercent}%.`
        : `Quiz finished with ${attempt.scorePercent}%. Review the weak topics.`,
    );
    persistAttempt(attempt, submissions);
  }, [active, mission, dispatch, persistAttempt]);

  const next = useCallback(() => {
    if (active === undefined) return;
    const current = active.questionOrder[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    if (current === undefined) return;
    const answer = active.answers[current];
    if (!answer?.submission) return;
    if (active.currentIndex < active.questionOrder.length - 1) {
      dispatch(nextQuestionAction());
      announceLive(`Question ${active.currentIndex + 2} of ${active.questionOrder.length}.`);
      return;
    }
    finalize();
  }, [active, dispatch, finalize]);

  const openAnsweredQuestion = useCallback(
    (questionId: QuestionId) => {
      if (active === undefined) return;
      const answer = active.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (answer?.submission === undefined) return;
      const index = active.questionOrder.indexOf(questionId);
      dispatch(openAnsweredQuestionAction({ questionId }));
      announceLive(
        `Reviewing question ${index + 1} of ${active.questionOrder.length}. Your answer is locked.`,
      );
    },
    [active, dispatch],
  );

  const exit = useCallback(() => {
    replace({ kind: 'mission', missionId, step: 'quiz' });
  }, [replace, missionId]);

  const retryQuiz = useCallback(() => {
    if (mission === undefined) return;
    const attemptId = crypto.randomUUID();
    const hadAttempts = hasPreviousAttempts || active?.status === 'finalized';
    dispatch(clearQuiz());
    dispatch(
      startQuizAction({
        attemptId,
        missionId,
        contentVersion: mission.contentVersion,
        questionOrder: orderQuestionsForAttempt(mission.questions, attemptId, hadAttempts).map(
          (question) => question.id,
        ),
        ...(hadAttempts ? { optionShuffleSeed: hashStringSeed(attemptId) } : {}),
        startedAt: nowIso(),
      }),
    );
    replace({ kind: 'quiz', missionId, attemptId });
  }, [dispatch, mission, missionId, hasPreviousAttempts, active, replace]);

  const retrySave = useCallback(() => {
    if (active === undefined || active.status !== 'finalized' || mission === undefined) return;
    const submissions = active.questionOrder.map((questionId) => {
      const answer = active.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (answer?.submission === undefined) {
        throw new Error('Cannot finalize a quiz with unanswered questions.');
      }
      return {
        questionId,
        selectedOptionIds: answer.submission.selectedOptionIds,
        ...(answer.submission.reasoning !== undefined
          ? { reasoning: answer.submission.reasoning }
          : {}),
      };
    });
    const attempt = buildQuizAttempt({
      attemptId: active.attemptId,
      missionId: active.missionId,
      contentVersion: active.contentVersion,
      questions: mission.questions,
      submissions,
      passThreshold: mission.passThreshold,
      startedAt: active.startedAt as IsoDateTime,
      completedAt: (active.summary?.completedAt ?? nowIso()) as IsoDateTime,
    });
    persistAttempt(attempt, submissions);
  }, [active, mission, persistAttempt]);

  const summary = active?.status === 'finalized' ? active.summary : undefined;

  return {
    ...(mission !== undefined ? { mission } : {}),
    isLoading,
    ...(error !== undefined ? { error } : {}),
    refresh: () => {
      void refresh();
    },
    ...(active !== undefined ? { attemptId: active.attemptId, status: active.status } : {}),
    ...(question !== undefined ? { question } : {}),
    questionNumber: progressModel !== undefined ? progressModel.currentIndex + 1 : 0,
    questionCount: progressModel?.total ?? 0,
    questionOrder: active?.questionOrder ?? [],
    answeredCount: progressModel?.answered ?? 0,
    answeredQuestionIds:
      active !== undefined
        ? active.questionOrder.filter(
            (questionId) => active.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */?.submission !== undefined,
          )
        : [],
    canSubmit,
    canGoNext: currentAnswer?.submission !== undefined,
    isLast: progressModel?.isLast ?? false,
    selection,
    ...(currentAnswer?.submission !== undefined ? { submission: currentAnswer.submission } : {}),
    reasoningDraft: currentAnswer?.reasoningDraft ?? '',
    isSaving,
    ...(saveError !== undefined ? { saveError } : {}),
    ...(summary !== undefined ? { summary } : {}),
    selectOptions,
    setReasoning,
    submit,
    next,
    openAnsweredQuestion,
    exit,
    retryQuiz,
    retrySave,
  };
}
