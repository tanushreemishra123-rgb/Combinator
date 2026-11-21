import { useMemo } from 'react';
import type {
  AwardDefinition,
  CatalogDto,
  MissionDetail,
  ProgressSnapshotDto,
  QuizAttempt,
} from '@ai-learning-adventure/types';
import { bestScoreFor, isMissionComplete, latestAttemptFor } from '@ai-learning-adventure/learner';

export interface UseMissionCompletionResult {
  isComplete: boolean;
  checkpointSatisfied: boolean;
  quizSatisfied: boolean;
  bestScore?: number;
  latestAttempt?: QuizAttempt;
  earnedAwards: AwardDefinition[];
}

export function useMissionCompletion(
  catalog: CatalogDto,
  mission: MissionDetail,
  progress: ProgressSnapshotDto,
): UseMissionCompletionResult {
  const missionProgress = progress.missions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  const checkpointSatisfied = missionProgress?.checkpointCompleted ?? false;

  const quizSatisfied = useMemo(
    () =>
      progress.attempts.some(
        (attempt) => attempt.missionId === mission.id && attempt.result === 'passed',
      ),
    [progress.attempts, mission.id],
  );

  const isComplete =
    isMissionComplete({
      missionId: mission.id,
      checkpointCompleted: checkpointSatisfied,
      attempts: progress.attempts,
    }) || missionProgress?.status === 'completed';

  const bestScore = useMemo(
    () => bestScoreFor(progress.attempts, mission.id),
    [progress.attempts, mission.id],
  );

  const latestAttempt = useMemo(
    () => latestAttemptFor(progress.attempts, mission.id),
    [progress.attempts, mission.id],
  );

  const earnedAwards = useMemo(() => {
    const earnedIds = new Set(progress.earnedAwards.map((entry) => entry.awardId as string));
    return catalog.awards.filter(
      (award) => award.missionId === mission.id && earnedIds.has(award.id),
    );
  }, [catalog.awards, progress.earnedAwards, mission.id]);

  return {
    isComplete,
    checkpointSatisfied,
    quizSatisfied,
    ...(bestScore !== undefined ? { bestScore } : {}),
    ...(latestAttempt !== undefined ? { latestAttempt } : {}),
    earnedAwards,
  };
}
