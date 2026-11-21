import awards from '../fixtures/mission-data/awards.json';
import flashcards from '../fixtures/mission-data/flashcards.json';
import missions from '../fixtures/mission-data/missions.json';
import questions from '../fixtures/mission-data/questions.json';
import type {
  AwardId,
  FlashcardRatingState,
  IsoDateTime,
  MissionId,
  MissionProgress,
  PortableProgressSnapshot,
  QuestionId,
  QuestionOption,
  QuizAnswer,
  QuizAttempt,
} from '@ai-learning-adventure/types';

export const seededMissions = missions;
export const seededQuestions = questions;
export const seededFlashcards = flashcards;
export const seededAwards = awards;

export const FIXED_TIME = '2026-08-14T10:00:00.000Z' as IsoDateTime;

export type SeedQuestionRecord = (typeof questions)[number];

export function questionRecordsFor(missionId: string): SeedQuestionRecord[] {
  return questions.filter((question) => question.missionId === missionId);
}

export function questionOptions(question: SeedQuestionRecord): QuestionOption[] {
  return JSON.parse(question.optionsJson) as QuestionOption[];
}

export function questionConceptTags(question: SeedQuestionRecord): string[] {
  return JSON.parse(question.conceptTagsJson) as string[];
}

export function missionRecord(missionId: string): (typeof missions)[number] {
  const mission = missions.find((candidate) => candidate.id === missionId);
  if (mission === undefined) throw new Error(`Copied fixture has no mission "${missionId}".`);
  return mission;
}

export function missionRecordsByTrack(track: string): typeof missions {
  return missions.filter((mission) => mission.levelTrack === track);
}

export function firstMissionRecord(): (typeof missions)[number] {
  const first = missions[0];
  if (first === undefined) throw new Error('Copied fixture has no missions.');
  return first;
}

export function questionCountFor(missionId: string): number {
  return questions.filter((question) => question.missionId === missionId).length;
}

export function flashcardCountFor(missionId: string): number {
  return flashcards.filter((card) => card.missionId === missionId).length;
}

export function awardCountFor(missionId: string): number {
  return awards.filter((award) => award.missionId === missionId).length;
}

export function makeMissionProgress(
  missionId: string,
  overrides: Partial<MissionProgress> = {},
): MissionProgress {
  return {
    missionId: missionId as MissionId,
    status: 'in_progress',
    furthestStep: 'lesson',
    checkpointCompleted: false,
    startedAt: FIXED_TIME,
    ...overrides,
  };
}

export type AnswerPattern = boolean | readonly boolean[] | ((index: number) => boolean);

function shouldAnswerCorrectly(pattern: AnswerPattern, index: number): boolean {
  if (typeof pattern === 'boolean') return pattern;
  if (typeof pattern === 'function') return pattern(index);
  return pattern[index] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? false;
}

export function makeQuizAttempt(
  missionId: string,
  pattern: AnswerPattern,
  suffix = '1',
): QuizAttempt {
  const records = questionRecordsFor(missionId);
  const answers: QuizAnswer[] = records.map((record, index) => {
    const options = questionOptions(record);
    const correct = shouldAnswerCorrectly(pattern, index);
    const selectedOptionIds = correct
      ? options.filter((option) => option.isCorrect).map((option) => option.id)
      : options.filter((option) => !option.isCorrect).slice(0, 1).map((option) => option.id);
    return {
      questionId: record.id as QuestionId,
      selectedOptionIds,
      isCorrect: correct,
      conceptTags: questionConceptTags(record),
    };
  });
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const questionCount = answers.length;
  const scorePercent = questionCount === 0 ? 0 : Math.round((correctCount / questionCount) * 100);
  const weakTopics = [
    ...new Set(
      answers.flatMap((answer) => (answer.isCorrect ? [] : answer.conceptTags)),
    ),
  ];
  return {
    id: `integration-attempt-${missionId}-${suffix}`,
    missionId: missionId as MissionId,
    contentVersion: missionRecord(missionId).contentVersion,
    answers,
    scorePercent,
    correctCount,
    questionCount,
    result: scorePercent >= missionRecord(missionId).passThreshold ? 'passed' : 'needs_review',
    weakTopics,
    startedAt: FIXED_TIME,
    completedAt: FIXED_TIME,
  };
}

export interface PortableProgressOptions {
  missions?: Record<string, MissionProgress>;
  attempts?: QuizAttempt[];
  flashcardRatings?: Record<string, FlashcardRatingState>;
  earnedAwards?: Array<{ awardId: AwardId; earnedAt: IsoDateTime }>;
}

export function makePortableProgress(
  options: PortableProgressOptions = {},
): PortableProgressSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: FIXED_TIME,
    missions: options.missions ?? {},
    attempts: options.attempts ?? [],
    flashcardRatings: options.flashcardRatings ?? {},
    earnedAwards: options.earnedAwards ?? [],
  };
}

export function makeCompletedProgress(missionIds: readonly string[]): PortableProgressSnapshot {
  return makePortableProgress({
    missions: Object.fromEntries(
      missionIds.map((missionId) => [
        missionId,
        makeMissionProgress(missionId, {
          status: 'completed',
          furthestStep: 'result',
          checkpointCompleted: true,
          completedAt: FIXED_TIME,
        }),
      ]),
    ),
    attempts: missionIds.map((missionId, index) =>
      makeQuizAttempt(missionId, true, String(index + 1)),
    ),
  });
}
