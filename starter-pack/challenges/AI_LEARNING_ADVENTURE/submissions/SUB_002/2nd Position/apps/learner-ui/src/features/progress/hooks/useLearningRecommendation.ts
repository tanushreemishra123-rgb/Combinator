import { useCallback, useMemo, useState } from 'react';
import type {
  CatalogDto,
  MissionId,
  MissionRecommendation,
  NextStepRecommendation,
  ProgressSnapshotDto,
  ReviewRecommendation,
} from '@ai-learning-adventure/types';
import {
  LEVEL_TRACK_LABELS,
  recommendNextStep,
} from '@ai-learning-adventure/learner';
import { useAppSelector } from '../../../store/index.ts';
import { selectWeakTopics } from '../../../store/progressProjectionSlice.ts';

export const AI_RATIONALE_MOCK_LABEL = 'Sample / mock AI response';

export interface AiRationale {
  text: string;
  isMock: boolean;
  label?: string;
}

export interface UseLearningRecommendationResult {
  recommendation: NextStepRecommendation;
  missionRecommendation?: MissionRecommendation;
  reviewRecommendation?: ReviewRecommendation;
  journeyComplete: boolean;
  aiRationale?: AiRationale;
  isAiRationalePending: boolean;
  requestAiRationale: () => void;
}

export function useLearningRecommendation(
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
  excludeMissionId?: MissionId,
): UseLearningRecommendationResult {
  const weakTopics = useAppSelector(selectWeakTopics);
  const [aiRationale, setAiRationale] = useState<AiRationale | undefined>(undefined);
  const [isAiRationalePending, setIsAiRationalePending] = useState(false);

  const recommendation = useMemo(
    () =>
      recommendNextStep({
        catalog,
        snapshot: progress,
        ...(excludeMissionId !== undefined ? { excludeMissionId } : {}),
        weakTopics,
      }),
    [catalog, progress, excludeMissionId, weakTopics],
  );

  const requestAiRationale = useCallback(() => {
    if (aiRationale !== undefined || isAiRationalePending) return;
    setIsAiRationalePending(true);
    void Promise.resolve().then(() => {
      const completedCount = catalog.missions.filter(
        (mission) => progress.missions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status === 'completed',
      ).length;
      let text: string;
      if (recommendation.kind === 'mission') {
        const trackLabel = LEVEL_TRACK_LABELS[recommendation.mission.mission.levelTrack] /* nosemgrep: gitlab.eslint.detect-object-injection */;
        text = `You've completed ${completedCount} of ${catalog.missions.length} missions — ${recommendation.mission.mission.title} continues your ${trackLabel} journey.`;
      } else if (recommendation.kind === 'review') {
        text = `A quick review of ${recommendation.review.topic} will turn your recent misses into wins.`;
      } else {
        text = 'You have finished every mission — review mode keeps your skills sharp.';
      }
      setAiRationale({ text, isMock: true, label: AI_RATIONALE_MOCK_LABEL });
      setIsAiRationalePending(false);
    });
  }, [aiRationale, isAiRationalePending, catalog, progress, recommendation]);

  return {
    recommendation,
    ...(recommendation.kind === 'mission' ? { missionRecommendation: recommendation.mission } : {}),
    ...(recommendation.kind === 'review' ? { reviewRecommendation: recommendation.review } : {}),
    journeyComplete: recommendation.kind === 'journey_complete',
    ...(aiRationale !== undefined ? { aiRationale } : {}),
    isAiRationalePending,
    requestAiRationale,
  };
}
