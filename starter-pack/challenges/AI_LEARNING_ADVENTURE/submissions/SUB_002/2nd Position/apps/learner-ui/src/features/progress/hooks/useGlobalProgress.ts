import { useEffect, useMemo, useRef } from 'react';
import type { CatalogDto, LevelTrack, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { countEarnedByKind, deriveProgressProjection, formatCompletedLabel } from '@ai-learning-adventure/learner';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export interface UseGlobalProgressResult {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  completedLabel: string;
  currentLevel: LevelTrack;
  badgeCount: number;
}

export function useGlobalProgress(
  catalog: CatalogDto | undefined,
  progress: ProgressSnapshotDto | undefined,
): UseGlobalProgressResult {
  const projection = useMemo(
    () =>
      catalog !== undefined && progress !== undefined
        ? deriveProgressProjection(catalog, progress)
        : undefined,
    [catalog, progress],
  );

  const completionPercent = projection?.completionPercent ?? 0;
  const completedCount = projection?.completedMissionCount ?? 0;
  const totalCount = catalog?.missions.length ?? 0;
  const currentLevel = projection?.currentLevel ?? 'beginner';
  const badgeCount = useMemo(
    () =>
      catalog !== undefined && progress !== undefined
        ? countEarnedByKind(catalog, progress).badges
        : 0,
    [catalog, progress],
  );
  const completedLabel = formatCompletedLabel(completedCount, totalCount);

  const mountedRef = useRef(false);
  const lastAnnouncedRef = useRef(completionPercent);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastAnnouncedRef.current = completionPercent;
      return;
    }
    if (completionPercent === lastAnnouncedRef.current) return;
    lastAnnouncedRef.current = completionPercent;
    announceLive(`Progress updated: ${completionPercent}% complete. ${completedLabel}.`);
  }, [completionPercent, completedLabel]);

  return {
    completionPercent,
    completedCount,
    totalCount,
    completedLabel,
    currentLevel,
    badgeCount,
  };
}
