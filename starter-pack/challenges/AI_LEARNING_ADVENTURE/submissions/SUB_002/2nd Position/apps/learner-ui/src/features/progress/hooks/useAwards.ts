import { useCallback, useMemo } from 'react';
import type {
  AwardDefinition,
  CatalogDto,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import {
  awardListItems,
  countEarnedByKind,
  milestoneProgressFor,
  type AwardListItem,
  type MilestoneProgress,
} from '@ai-learning-adventure/learner';

export type { AwardListItem };
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  dequeueAward,
  selectNextAwardDialog,
} from '../../../store/progressProjectionSlice.ts';

export interface MilestoneListItem extends AwardListItem {
  progress?: MilestoneProgress;
}

export interface UseAwardsResult {
  badges: AwardListItem[];
  milestones: MilestoneListItem[];
  badgeCount: number;
  milestoneCount: number;
  activeAward?: AwardDefinition;
  dismissActiveAward: () => void;
}

export function useAwards(
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
): UseAwardsResult {
  const dispatch = useAppDispatch();
  const nextAwardId = useAppSelector(selectNextAwardDialog);

  const badges = useMemo(
    () => awardListItems(catalog, progress, 'badge'),
    [catalog, progress],
  );

  const milestones = useMemo<MilestoneListItem[]>(
    () =>
      awardListItems(catalog, progress, 'milestone').map((item) => {
        if (item.earned) return item;
        const milestoneProgress = milestoneProgressFor(item.award, { catalog, snapshot: progress });
        return milestoneProgress !== undefined ? { ...item, progress: milestoneProgress } : item;
      }),
    [catalog, progress],
  );

  const counts = useMemo(() => countEarnedByKind(catalog, progress), [catalog, progress]);

  const activeAward = useMemo(
    () =>
      nextAwardId !== undefined
        ? catalog.awards.find((award) => award.id === nextAwardId)
        : undefined,
    [catalog.awards, nextAwardId],
  );

  const dismissActiveAward = useCallback(() => {
    dispatch(dequeueAward());
  }, [dispatch]);

  return {
    badges,
    milestones,
    badgeCount: counts.badges,
    milestoneCount: counts.milestones,
    ...(activeAward !== undefined ? { activeAward } : {}),
    dismissActiveAward,
  };
}
