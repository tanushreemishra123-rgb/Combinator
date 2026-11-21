import { useMemo } from 'react';
import type {
  AwardDefinition,
  CatalogDto,
  LevelTrack,
  MissionSummary,
  MissionProgressStatus,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import {
  deriveLevelLadder,
  deriveProgressProjection,
  missionProgressRows,
  scoreSeries,
  type LevelLadderRow,
  type ScorePoint,
} from '@ai-learning-adventure/learner';
import type { WeakTopicSignal } from '../../../store/progressProjectionSlice.ts';
import { useAwards, type UseAwardsResult } from './useAwards.ts';
import { useLearningRecommendation, type UseLearningRecommendationResult } from './useLearningRecommendation.ts';
import { useReviewDeck } from '../../practice/hooks/useReviewDeck.ts';

export interface DashboardMissionRow {
  mission: MissionSummary;
  status: MissionProgressStatus;
  bestScore?: number;
  latestScore?: number;
  earnedBadge?: AwardDefinition;
}

export interface DashboardSummary {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  badgeCount: number;
  milestoneCount: number;
}

export interface UseProgressDashboardResult {
  summary: DashboardSummary;
  currentLevel: LevelTrack;
  missionRows: DashboardMissionRow[];
  scorePoints: ScorePoint[];
  weakTopics: WeakTopicSignal[];
  ladder: LevelLadderRow[];
  awards: UseAwardsResult;
  recommendation: UseLearningRecommendationResult;
}

export function useProgressDashboard(
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
): UseProgressDashboardResult {
  const projection = useMemo(
    () => deriveProgressProjection(catalog, progress),
    [catalog, progress],
  );
  const review = useReviewDeck(catalog, progress);

  const missionRows = useMemo<DashboardMissionRow[]>(() => {
    const rows = missionProgressRows(catalog, progress);
    const earnedAwardIds = new Set(progress.earnedAwards.map((entry) => entry.awardId as string));
    return rows.map((row) => {
      const mission = catalog.missions.find((candidate) => candidate.id === row.missionId);
      if (mission === undefined) {
        return undefined;
      }
      const earnedBadge = catalog.awards.find(
        (award) =>
          award.kind === 'badge' &&
          award.missionId === mission.id &&
          earnedAwardIds.has(award.id as string),
      );
      return {
        mission,
        status: row.status,
        ...(row.bestScore !== undefined ? { bestScore: row.bestScore } : {}),
        ...(row.latestScore !== undefined ? { latestScore: row.latestScore } : {}),
        ...(earnedBadge !== undefined ? { earnedBadge } : {}),
      };
    }).filter((row): row is DashboardMissionRow => row !== undefined);
  }, [catalog, progress]);

  const scorePoints = useMemo(() => scoreSeries(progress.attempts), [progress.attempts]);

  const ladder = useMemo(() => deriveLevelLadder(catalog, progress), [catalog, progress]);

  const awards = useAwards(catalog, progress);
  const recommendation = useLearningRecommendation(catalog, progress);

  return {
    summary: {
      completionPercent: projection.completionPercent,
      completedCount: projection.completedMissionCount,
      totalCount: catalog.missions.length,
      badgeCount: awards.badgeCount,
      milestoneCount: awards.milestoneCount,
    },
    currentLevel: projection.currentLevel,
    missionRows,
    scorePoints,
    weakTopics: review.topics.length > 0 ? review.topics : projection.weakTopics,
    ladder,
    awards,
    recommendation,
  };
}
