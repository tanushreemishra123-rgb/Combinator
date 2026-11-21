import { useMemo } from 'react';
import type {
  CatalogDto,
  MissionDetail,
  ProgressSnapshotDto,
  QuizAttempt,
  QuizAttemptResult,
  QuizQuestion,
} from '@ai-learning-adventure/types';
import {
  bestScoreFor,
  gradeQuestion,
  latestAttemptFor,
  rankWeakTopics,
} from '@ai-learning-adventure/learner';
import type { WeakTopicSignal } from '@ai-learning-adventure/learner';
import { useAppSelector } from '../../../store/index.ts';
import { selectActiveQuiz } from '../../../store/quizSessionSlice.ts';

export interface QuizRecapRow {
  question: QuizQuestion;
  selectedOptionIds: string[];
  isCorrect: boolean;
  explanation: string;
  missedCorrectOptionIds: string[];
  incorrectSelectedOptionIds: string[];
}

export interface UseQuizResultsResult {
  attempt?: QuizAttempt;
  attemptHistory: QuizAttempt[];
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  result?: QuizAttemptResult;
  recapRows: QuizRecapRow[];
  weakTopics: WeakTopicSignal[];
  bestScore?: number;
  latestScore?: number;
  isSaving: boolean;
}

export function useQuizResults(
  mission: MissionDetail,
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
  isSaving: boolean,
): UseQuizResultsResult {
  const active = useAppSelector(selectActiveQuiz);

  const localAttempt = useMemo(() => {
    if (active === undefined || active.status !== 'finalized' || active.summary === undefined) {
      return undefined;
    }
    const answers = active.questionOrder.map((questionId) => {
      const answer = active.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      const question = mission.questions.find((candidate) => candidate.id === questionId);
      return {
        questionId,
        selectedOptionIds: answer?.submission?.selectedOptionIds ?? [],
        ...(answer?.submission?.reasoning !== undefined
          ? { reasoning: answer.submission.reasoning }
          : {}),
        isCorrect: answer?.submission?.isCorrect ?? false,
        conceptTags: question?.conceptTags ?? [],
      };
    });
    return {
      id: active.attemptId,
      missionId: active.missionId,
      contentVersion: active.contentVersion,
      answers,
      scorePercent: active.summary.scorePercent,
      correctCount: active.summary.correctCount,
      questionCount: active.summary.questionCount,
      result: active.summary.result,
      weakTopics: active.summary.weakTopics,
      startedAt: active.startedAt as QuizAttempt['startedAt'],
      completedAt: active.summary.completedAt as QuizAttempt['completedAt'],
    } satisfies QuizAttempt;
  }, [active, mission.questions]);

  const attemptHistory = useMemo(() => {
    const canonical = progress.attempts
      .filter((attempt) => attempt.missionId === mission.id)
      .slice()
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    if (
      localAttempt !== undefined &&
      !canonical.some((attempt) => attempt.id === localAttempt.id)
    ) {
      return [localAttempt, ...canonical];
    }
    return canonical;
  }, [progress.attempts, mission.id, localAttempt]);

  const attempt = attemptHistory[0];

  const recapRows = useMemo<QuizRecapRow[]>(() => {
    if (attempt === undefined) return [];
    return attempt.answers.flatMap((answer) => {
      const question = mission.questions.find((candidate) => candidate.id === answer.questionId);
      if (question === undefined) return [];
      const grade = gradeQuestion(question, answer.selectedOptionIds);
      return [
        {
          question,
          selectedOptionIds: answer.selectedOptionIds,
          isCorrect: answer.isCorrect,
          explanation: answer.isCorrect
            ? question.correctExplanation
            : question.incorrectExplanation,
          missedCorrectOptionIds: grade.missedCorrectOptionIds,
          incorrectSelectedOptionIds: grade.incorrectSelectedOptionIds,
        },
      ];
    });
  }, [attempt, mission.questions]);

  const weakTopics = useMemo(() => {
    if (attempt === undefined) return [];
    const needsWorkTags = Object.entries(progress.flashcardRatings)
      .filter(([, rating]) => rating.rating === 'needs_work')
      .flatMap(([cardId]) => {
        const card = mission.flashcards.find((candidate) => candidate.id === cardId);
        return card !== undefined ? [{ tags: card.conceptTags }] : [];
      });
    return rankWeakTopics({ attempts: [attempt], needsWorkTagInputs: needsWorkTags });
  }, [attempt, progress.flashcardRatings, mission.flashcards]);

  const bestScore = useMemo(
    () => bestScoreFor(attemptHistory, mission.id),
    [attemptHistory, mission.id],
  );
  const latestScore = useMemo(
    () => latestAttemptFor(attemptHistory, mission.id)?.scorePercent,
    [attemptHistory, mission.id],
  );

  return {
    ...(attempt !== undefined ? { attempt } : {}),
    attemptHistory,
    scorePercent: attempt?.scorePercent ?? 0,
    correctCount: attempt?.correctCount ?? 0,
    questionCount: attempt?.questionCount ?? 0,
    ...(attempt !== undefined ? { result: attempt.result } : {}),
    recapRows,
    weakTopics,
    ...(bestScore !== undefined ? { bestScore } : {}),
    ...(latestScore !== undefined ? { latestScore } : {}),
    isSaving,
  };
}
