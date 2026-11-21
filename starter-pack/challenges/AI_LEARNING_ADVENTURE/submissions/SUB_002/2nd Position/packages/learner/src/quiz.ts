import type {
  IsoDateTime,
  MissionId,
  QuestionId,
  QuestionOption,
  QuizAnswer,
  QuizAttempt,
  QuizAttemptAnswerInput,
  QuizAttemptInput,
  QuizAttemptResult,
  QuizQuestion,
} from '@ai-learning-adventure/types';

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return function next(): number {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffleItems<T>(items: readonly T[], seed: number): T[] {
  const shuffled = [...items];
  const random = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i]!; // nosemgrep: gitlab.eslint.detect-object-injection
    shuffled[i] = shuffled[j]!; // nosemgrep: gitlab.eslint.detect-object-injection
    shuffled[j] = temp;
  }
  return shuffled;
}

export function shuffleQuestions(
  questions: readonly QuizQuestion[],
  seed: number,
): QuizQuestion[] {
  return shuffleItems(questions, seed);
}

export function shuffleQuestionOptions(
  question: QuizQuestion,
  seed: number,
): QuizQuestion {
  return { ...question, options: shuffleItems(question.options, seed) };
}

export function orderQuestionsForAttempt(
  questions: readonly QuizQuestion[],
  attemptId: string,
  isRetry: boolean,
): QuizQuestion[] {
  return isRetry ? shuffleQuestions(questions, hashStringSeed(attemptId)) : [...questions];
}

export function optionsForQuestion(
  question: QuizQuestion,
  attemptId: string,
  optionShuffleSeed: number | undefined,
): QuestionOption[] {
  if (optionShuffleSeed === undefined) return question.options;
  return shuffleItems(question.options, hashStringSeed(`${attemptId}:${question.id}:${optionShuffleSeed}`));
}

export interface QuestionGrade {
  isCorrect: boolean;
  correctOptionIds: string[];
  missedCorrectOptionIds: string[];
  incorrectSelectedOptionIds: string[];
}

export function gradeQuestion(
  question: QuizQuestion,
  selectedOptionIds: readonly string[],
): QuestionGrade {
  const correctOptionIds = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);
  const correctSet = new Set(correctOptionIds);
  const selectedSet = new Set(selectedOptionIds);
  const incorrectSelectedOptionIds = selectedOptionIds.filter((id) => !correctSet.has(id));
  const missedCorrectOptionIds = correctOptionIds.filter((id) => !selectedSet.has(id));
  const isCorrect = incorrectSelectedOptionIds.length === 0 && missedCorrectOptionIds.length === 0;
  return { isCorrect, correctOptionIds, missedCorrectOptionIds, incorrectSelectedOptionIds };
}

export interface QuizAnswerSubmission {
  questionId: QuestionId;
  selectedOptionIds: readonly string[];
  reasoning?: string;
}

export function gradeQuizAnswers(
  questions: readonly QuizQuestion[],
  submissions: readonly QuizAnswerSubmission[],
): QuizAnswer[] {
  const byId = new Map(questions.map((question) => [question.id as string, question]));
  return submissions.map((submission) => {
    const question = byId.get(submission.questionId as string);
    if (question === undefined) {
      throw new Error(`Cannot grade unknown question "${submission.questionId}".`);
    }
    const grade = gradeQuestion(question, submission.selectedOptionIds);
    return {
      questionId: submission.questionId,
      selectedOptionIds: [...submission.selectedOptionIds],
      ...(submission.reasoning !== undefined ? { reasoning: submission.reasoning } : {}),
      isCorrect: grade.isCorrect,
      conceptTags: question.conceptTags,
    };
  });
}

export interface QuizScore {
  correctCount: number;
  questionCount: number;
  scorePercent: number;
}

export function computeQuizScore(answers: readonly QuizAnswer[]): QuizScore {
  const questionCount = answers.length;
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const scorePercent =
    questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100);
  return { correctCount, questionCount, scorePercent };
}

export function quizAttemptResult(
  scorePercent: number,
  passThreshold: number,
): QuizAttemptResult {
  return scorePercent >= passThreshold ? 'passed' : 'needs_review';
}

export interface WeakTopicSignal {
  topic: string;
  weight: number;
  sources: string[];
}

export function weakTopicsFromAnswers(
  answers: readonly QuizAnswer[],
): WeakTopicSignal[] {
  const byTopic = new Map<string, { weight: number }>();
  for (const answer of answers) {
    if (answer.isCorrect) continue;
    for (const topic of answer.conceptTags) {
      const entry = byTopic.get(topic) ?? { weight: 0 };
      entry.weight += 1;
      byTopic.set(topic, entry);
    }
  }
  return [...byTopic.entries()]
    .map(([topic, entry]) => ({ topic, weight: entry.weight, sources: ['quiz'] }))
    .sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
}

export interface BuildQuizAttemptInput {
  attemptId: string;
  missionId: MissionId;
  contentVersion: number;
  questions: readonly QuizQuestion[];
  submissions: readonly QuizAnswerSubmission[];
  passThreshold: number;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
}

export function buildQuizAttempt(input: BuildQuizAttemptInput): QuizAttempt {
  const answers = gradeQuizAnswers(input.questions, input.submissions);
  const score = computeQuizScore(answers);
  const result = quizAttemptResult(score.scorePercent, input.passThreshold);
  const weakTopics = weakTopicsFromAnswers(answers).map((signal) => signal.topic);
  return {
    id: input.attemptId,
    missionId: input.missionId,
    contentVersion: input.contentVersion,
    answers,
    scorePercent: score.scorePercent,
    correctCount: score.correctCount,
    questionCount: score.questionCount,
    result,
    weakTopics,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}

export function buildQuizAttemptInput(input: {
  attemptId: string;
  missionId: MissionId;
  contentVersion: number;
  submissions: readonly QuizAnswerSubmission[];
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
}): QuizAttemptInput {
  const answers: QuizAttemptAnswerInput[] = input.submissions.map((submission) => ({
    questionId: submission.questionId,
    selectedOptionIds: [...submission.selectedOptionIds],
    ...(submission.reasoning !== undefined ? { reasoning: submission.reasoning } : {}),
  }));
  return {
    id: input.attemptId,
    missionId: input.missionId,
    contentVersion: input.contentVersion,
    answers,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}
