import type { MissionSummary } from './content.ts';

export type RecommendationSource = 'deterministic' | 'ai';

export interface MissionRecommendation {
  mission: MissionSummary;
  reason: string;
  source: RecommendationSource;
}

export interface ReviewRecommendation {
  topic: string;
  reason: string;
  weight: number;
  sources: string[];
}

export type NextStepRecommendation =
  | { kind: 'review'; review: ReviewRecommendation }
  | { kind: 'mission'; mission: MissionRecommendation }
  | { kind: 'journey_complete' };
