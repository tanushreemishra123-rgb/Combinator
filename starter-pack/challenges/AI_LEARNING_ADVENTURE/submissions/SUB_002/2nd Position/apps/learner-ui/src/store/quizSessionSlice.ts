import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MissionId, QuestionId, QuizAttemptResult } from '@ai-learning-adventure/types';
import type { RootState } from './index.ts';

export type QuizSessionStatus = 'in_progress' | 'finalized';

export interface QuizAnswerSubmission {
  selectedOptionIds: string[];
  reasoning?: string;
  isCorrect: boolean;
  submittedAt: string;
}

export interface QuizAnswerState {
  questionId: QuestionId;
  selectedOptionIds: string[];
  reasoningDraft: string;
  submission?: QuizAnswerSubmission;
}

export interface FinalizedQuizSummary {
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  result: QuizAttemptResult;
  weakTopics: string[];
  completedAt: string;
}

export interface ActiveQuizSession {
  attemptId: string;
  missionId: MissionId;
  contentVersion: number;
  questionOrder: QuestionId[];
  optionShuffleSeed?: number;
  currentIndex: number;
  answers: Record<string, QuizAnswerState>;
  startedAt: string;
  status: QuizSessionStatus;
  summary?: FinalizedQuizSummary;
}

export interface QuizSessionState {
  active?: ActiveQuizSession;
}

export interface StartQuizPayload {
  attemptId: string;
  missionId: MissionId;
  contentVersion: number;
  questionOrder: QuestionId[];
  optionShuffleSeed?: number;
  startedAt: string;
}

export interface SelectOptionsPayload {
  questionId: QuestionId;
  optionIds: string[];
}

export interface SetReasoningDraftPayload {
  questionId: QuestionId;
  reasoning: string;
}

export interface SubmitLocalAnswerPayload {
  questionId: QuestionId;
  isCorrect: boolean;
  submittedAt: string;
}

export interface OpenAnsweredQuestionPayload {
  questionId: QuestionId;
}

export interface FinalizeLocalAttemptPayload {
  scorePercent: number;
  correctCount: number;
  result: QuizAttemptResult;
  weakTopics: string[];
  completedAt: string;
}

const initialState: QuizSessionState = {};

export const quizSessionSlice = createSlice({
  name: 'quizSession',
  initialState,
  reducers: {
    startQuiz(state, action: PayloadAction<StartQuizPayload>) {
      if (state.active) return;
      const {
        attemptId,
        missionId,
        contentVersion,
        questionOrder,
        optionShuffleSeed,
        startedAt,
      } = action.payload;
      const answers: Record<string, QuizAnswerState> = {};
      for (const questionId of questionOrder) {
        answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = { questionId, selectedOptionIds: [], reasoningDraft: '' };
      }
      state.active = {
        attemptId,
        missionId,
        contentVersion,
        questionOrder,
        ...(optionShuffleSeed !== undefined ? { optionShuffleSeed } : {}),
        currentIndex: 0,
        answers,
        startedAt,
        status: 'in_progress',
      };
    },
    selectOptions(state, action: PayloadAction<SelectOptionsPayload>) {
      const active = state.active;
      if (!active || active.status !== 'in_progress') return;
      const answer = active.answers[action.payload.questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!answer || answer.submission) return;
      answer.selectedOptionIds = action.payload.optionIds;
    },
    setReasoningDraft(state, action: PayloadAction<SetReasoningDraftPayload>) {
      const active = state.active;
      if (!active || active.status !== 'in_progress') return;
      const answer = active.answers[action.payload.questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!answer || answer.submission) return;
      answer.reasoningDraft = action.payload.reasoning;
    },
    submitLocalAnswer(state, action: PayloadAction<SubmitLocalAnswerPayload>) {
      const active = state.active;
      if (!active || active.status !== 'in_progress') return;
      const answer = active.answers[action.payload.questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!answer || answer.submission) return;
      answer.submission = {
        selectedOptionIds: [...answer.selectedOptionIds],
        reasoning: answer.reasoningDraft.length > 0 ? answer.reasoningDraft : undefined,
        isCorrect: action.payload.isCorrect,
        submittedAt: action.payload.submittedAt,
      };
    },
    nextQuestion(state) {
      const active = state.active;
      if (!active) return;
      const currentQuestionId = active.questionOrder[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (currentQuestionId === undefined) return;
      const currentAnswer = active.answers[currentQuestionId];
      if (!currentAnswer?.submission) return;
      if (active.currentIndex < active.questionOrder.length - 1) {
        active.currentIndex += 1;
      }
    },
    openAnsweredQuestion(state, action: PayloadAction<OpenAnsweredQuestionPayload>) {
      const active = state.active;
      if (!active) return;
      const index = active.questionOrder.indexOf(action.payload.questionId);
      if (index < 0) return;
      const answer = active.answers[action.payload.questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (!answer?.submission) return;
      active.currentIndex = index;
    },
    finalizeLocalAttempt(state, action: PayloadAction<FinalizeLocalAttemptPayload>) {
      const active = state.active;
      if (!active || active.status !== 'in_progress') return;
      active.status = 'finalized';
      active.summary = {
        ...action.payload,
        questionCount: active.questionOrder.length,
      };
    },
    abandonQuiz(state) {
      state.active = undefined;
    },
    clearQuiz(state) {
      state.active = undefined;
    },
  },
});

export const {
  startQuiz,
  selectOptions,
  setReasoningDraft,
  submitLocalAnswer,
  nextQuestion,
  openAnsweredQuestion,
  finalizeLocalAttempt,
  abandonQuiz,
  clearQuiz,
} = quizSessionSlice.actions;

export function selectActiveQuiz(state: RootState): ActiveQuizSession | undefined {
  return state.quizSession.active;
}

export function selectCurrentQuestionId(state: RootState): QuestionId | undefined {
  const active = state.quizSession.active;
  if (!active) return undefined;
  return active.questionOrder[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

const EMPTY_SELECTION: string[] = [];

export function selectCurrentSelection(state: RootState): string[] {
  const active = state.quizSession.active;
  if (!active) return EMPTY_SELECTION;
  const questionId = active.questionOrder[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  if (questionId === undefined) return EMPTY_SELECTION;
  const answer = active.answers[questionId];
  if (!answer) return EMPTY_SELECTION;
  return answer.submission?.selectedOptionIds ?? answer.selectedOptionIds;
}

export function selectQuizCanSubmit(state: RootState): boolean {
  const active = state.quizSession.active;
  if (!active || active.status !== 'in_progress') return false;
  const questionId = active.questionOrder[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  if (questionId === undefined) return false;
  const answer = active.answers[questionId];
  if (!answer || answer.submission) return false;
  return answer.selectedOptionIds.length > 0;
}

export function selectQuizAnswer(questionId: QuestionId) {
  return (state: RootState): QuizAnswerState | undefined =>
    state.quizSession.active?.answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

const QUIZ_SESSION_STORAGE_KEY = 'learner-ui.quiz-session.v1';
const QUIZ_SESSION_STORAGE_VERSION = 1;

function isQuizSessionStatus(value: unknown): value is QuizSessionStatus {
  return value === 'in_progress' || value === 'finalized';
}

function parseQuizAnswerState(value: unknown): QuizAnswerState | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.questionId !== 'string') return undefined;
  if (!Array.isArray(candidate.selectedOptionIds) ||
      candidate.selectedOptionIds.some((id) => typeof id !== 'string')) return undefined;
  if (candidate.reasoningDraft !== undefined && typeof candidate.reasoningDraft !== 'string') {
    return undefined;
  }
  const answer: QuizAnswerState = {
    questionId: candidate.questionId as QuestionId,
    selectedOptionIds: candidate.selectedOptionIds as string[],
    reasoningDraft: (candidate.reasoningDraft as string | undefined) ?? '',
  };
  if (candidate.submission !== undefined) {
    if (typeof candidate.submission !== 'object' || candidate.submission === null) return undefined;
    const submission = candidate.submission as Record<string, unknown>;
    if (
      typeof submission.isCorrect !== 'boolean' ||
      typeof submission.submittedAt !== 'string' ||
      !Array.isArray(submission.selectedOptionIds) ||
      submission.selectedOptionIds.some((id) => typeof id !== 'string')
    ) {
      return undefined;
    }
    answer.submission = {
      selectedOptionIds: submission.selectedOptionIds as string[],
      ...(typeof submission.reasoning === 'string' ? { reasoning: submission.reasoning } : {}),
      isCorrect: submission.isCorrect,
      submittedAt: submission.submittedAt,
    };
  }
  return answer;
}

function parseActiveQuizSession(value: unknown): ActiveQuizSession | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.attemptId !== 'string' ||
    typeof candidate.missionId !== 'string' ||
    typeof candidate.contentVersion !== 'number' ||
    typeof candidate.currentIndex !== 'number' ||
    typeof candidate.startedAt !== 'string' ||
    !isQuizSessionStatus(candidate.status) ||
    !Array.isArray(candidate.questionOrder) ||
    candidate.questionOrder.some((id) => typeof id !== 'string') ||
    typeof candidate.answers !== 'object' ||
    candidate.answers === null
  ) {
    return undefined;
  }
  const answers: Record<string, QuizAnswerState> = {};
  for (const [questionId, raw] of Object.entries(candidate.answers as Record<string, unknown>)) {
    const answer = parseQuizAnswerState(raw);
    if (answer === undefined) return undefined;
    answers[questionId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = answer;
  }
  const active: ActiveQuizSession = {
    attemptId: candidate.attemptId,
    missionId: candidate.missionId as MissionId,
    contentVersion: candidate.contentVersion,
    questionOrder: candidate.questionOrder as QuestionId[],
    currentIndex: candidate.currentIndex,
    answers,
    startedAt: candidate.startedAt,
    status: candidate.status,
  };
  if (typeof candidate.optionShuffleSeed === 'number') {
    active.optionShuffleSeed = candidate.optionShuffleSeed;
  }
  if (candidate.status === 'finalized') {
    if (typeof candidate.summary !== 'object' || candidate.summary === null) return undefined;
    const summary = candidate.summary as Record<string, unknown>;
    if (
      typeof summary.scorePercent !== 'number' ||
      typeof summary.correctCount !== 'number' ||
      typeof summary.questionCount !== 'number' ||
      (summary.result !== 'passed' && summary.result !== 'needs_review') ||
      !Array.isArray(summary.weakTopics) ||
      summary.weakTopics.some((topic) => typeof topic !== 'string') ||
      typeof summary.completedAt !== 'string'
    ) {
      return undefined;
    }
    active.summary = {
      scorePercent: summary.scorePercent,
      correctCount: summary.correctCount,
      questionCount: summary.questionCount,
      result: summary.result as QuizAttemptResult,
      weakTopics: summary.weakTopics as string[],
      completedAt: summary.completedAt,
    };
  }
  return active;
}

export function loadPersistedQuizSession(): QuizSessionState | undefined {
  try {
    const raw = sessionStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<{ version: number; active: unknown }> | null;
    if (!parsed || parsed.version !== QUIZ_SESSION_STORAGE_VERSION) return undefined;
    const active = parseActiveQuizSession(parsed.active);
    return active !== undefined ? { active } : undefined;
  } catch {
    return undefined;
  }
}

export function persistQuizSession(state: QuizSessionState): void {
  try {
    const persisted = { version: QUIZ_SESSION_STORAGE_VERSION, active: state.active };
    sessionStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return;
  }
}

export interface QuizProgressModel {
  total: number;
  answered: number;
  currentIndex: number;
  isLast: boolean;
}

export function selectQuizProgress(state: RootState): QuizProgressModel | undefined {
  const active = state.quizSession.active;
  if (!active) return undefined;
  const total = active.questionOrder.length;
  const answered = Object.values(active.answers).filter((answer) => answer.submission !== undefined)
    .length;
  return {
    total,
    answered,
    currentIndex: active.currentIndex,
    isLast: active.currentIndex === total - 1,
  };
}
