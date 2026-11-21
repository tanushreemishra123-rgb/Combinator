import type {
  AwardId,
  IsoDateTime,
  LevelTrack,
  MissionId,
  MissionStep,
  QuestionId,
} from './content.ts';

export type MissionProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type FlashcardRatingValue = 'got_it' | 'needs_work';
export type QuizAttemptResult = 'passed' | 'needs_review';

export interface MissionProgress {
  missionId: MissionId;
  status: MissionProgressStatus;
  furthestStep: MissionStep;
  checkpointCompleted: boolean;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
}

export interface QuizAnswer {
  questionId: QuestionId;
  selectedOptionIds: string[];
  reasoning?: string;
  isCorrect: boolean;
  conceptTags: string[];
}

export interface QuizAttempt {
  id: string;
  missionId: MissionId;
  contentVersion: number;
  answers: QuizAnswer[];
  scorePercent: number;
  correctCount: number;
  questionCount: number;
  result: QuizAttemptResult;
  weakTopics: string[];
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
}

export interface FlashcardRatingState {
  rating: FlashcardRatingValue;
  reviewCount: number;
  updatedAt: IsoDateTime;
}

export interface ProgressSnapshot {
  learnerId: string;
  schemaVersion: number;
  revision: IsoDateTime;
  missions: Record<string, MissionProgress>;
  attempts: QuizAttempt[];
  flashcardRatings: Record<string, FlashcardRatingState>;
  earnedAwards: Array<{ awardId: AwardId; earnedAt: IsoDateTime }>;
}

export interface ProgressProjection {
  completionPercent: number;
  completedMissionCount: number;
  currentLevel: LevelTrack;
  bestScoreByMission: Record<string, number>;
  latestScoreByMission: Record<string, number>;
  weakTopics: Array<{ topic: string; weight: number; sources: string[] }>;
}
