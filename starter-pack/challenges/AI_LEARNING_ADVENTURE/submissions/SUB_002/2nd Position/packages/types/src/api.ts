import type {
  AwardDefinition,
  AwardId,
  FlashcardId,
  IsoDateTime,
  MissionDetail,
  MissionId,
  MissionStep,
  MissionSummary,
  QuestionId,
} from './content.ts';
import type {
  FlashcardRatingState,
  FlashcardRatingValue,
  MissionProgress,
  ProgressProjection,
  ProgressSnapshot,
  QuizAttempt,
} from './progress.ts';

export interface ApiResponse<T> {
  data: T;
  meta?: { requestId: string; etag?: string };
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}

export interface CatalogDto {
  contentVersion: string;
  missions: MissionSummary[];
  awards: AwardDefinition[];
}

export interface MissionDetailDto {
  mission: MissionDetail;
}

export type ProgressSnapshotDto = ProgressSnapshot;

export interface ProgressMutationDto {
  snapshot: ProgressSnapshot;
  newlyEarnedAwards: AwardId[];
}

export interface QuizAttemptMutationDto extends ProgressMutationDto {
  attempt: QuizAttempt;
}

export interface FlashcardRatingMutationDto {
  flashcardId: FlashcardId;
  rating: FlashcardRatingValue;
  reviewCount: number;
  updatedAt: IsoDateTime;
  weakTopics: ProgressProjection['weakTopics'];
}

export interface HealthDto {
  status: 'ok';
  database: 'ok';
}

export interface UpdateMissionProgressRequest {
  idempotencyKey: string;
  furthestStep: MissionStep;
  checkpointCompleted?: boolean;
  completed?: boolean;
  occurredAt: IsoDateTime;
}

export interface QuizAttemptAnswerInput {
  questionId: QuestionId;
  selectedOptionIds: string[];
  reasoning?: string;
}

export interface QuizAttemptInput {
  id: string;
  missionId: MissionId;
  contentVersion: number;
  answers: QuizAttemptAnswerInput[];
  startedAt: IsoDateTime;
  completedAt: IsoDateTime;
}

export interface RecordQuizAttemptRequest {
  idempotencyKey: string;
  attempt: QuizAttemptInput;
  completionCandidate: boolean;
  awardCandidateIds: AwardId[];
}

export interface RateFlashcardRequest {
  idempotencyKey: string;
  rating: FlashcardRatingValue;
  occurredAt: IsoDateTime;
}

export interface PortableProgressSnapshot {
  schemaVersion: number;
  exportedAt: IsoDateTime;
  missions: Record<string, MissionProgress>;
  attempts: QuizAttempt[];
  flashcardRatings: Record<string, FlashcardRatingState>;
  earnedAwards: Array<{ awardId: AwardId; earnedAt: IsoDateTime }>;
}

export interface ImportProgressRequest {
  idempotencyKey: string;
  snapshot: PortableProgressSnapshot;
  mode: 'replace';
}
