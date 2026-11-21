import { useCallback, useMemo } from 'react';
import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { findResumeTarget, hasTouchedAnyMission, type ResumeTarget } from '@ai-learning-adventure/learner';
import { useAppDispatch } from '../../../store/index.ts';
import { startMission } from '../../../store/missionSessionSlice.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';

export type JourneyEntryMode = 'start' | 'continue';

export interface UseJourneyEntryResult {
  mode: JourneyEntryMode;
  target?: ResumeTarget;
  label: string;
  missionText?: string;
  progressText?: string;
  completionPercent: number;
  open: () => void;
}

export function useJourneyEntry(
  catalog: CatalogDto | undefined,
  progress: ProgressSnapshotDto | undefined,
): UseJourneyEntryResult {
  const dispatch = useAppDispatch();
  const { navigate } = useAppNavigation();

  const target = useMemo(
    () => (catalog !== undefined && progress !== undefined ? findResumeTarget(catalog, progress) : undefined),
    [catalog, progress],
  );

  const mode: JourneyEntryMode = useMemo(() => {
    if (catalog === undefined || progress === undefined) return 'start';
    return hasTouchedAnyMission(catalog, progress) ? 'continue' : 'start';
  }, [catalog, progress]);

  const label = mode === 'start' ? 'Start the adventure' : 'Continue your adventure';

  const missionText = useMemo(() => {
    if (mode !== 'continue' || catalog === undefined || target === undefined) return undefined;
    const index = catalog.missions.findIndex((mission) => mission.id === target.mission.id);
    return `Mission ${index + 1} · ${target.mission.title}`;
  }, [mode, catalog, target]);

  const completedCount = useMemo(() => {
    if (catalog === undefined || progress === undefined) return 0;
    return catalog.missions.filter(
      (mission) => progress.missions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status === 'completed',
    ).length;
  }, [catalog, progress]);

  const totalCount = catalog?.missions.length ?? 0;
  const completionPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const progressText =
    totalCount === 0 ? undefined : `${completedCount} of ${totalCount} missions · ${completionPercent}%`;

  const open = useCallback(() => {
    if (target === undefined) return;
    dispatch(
      startMission({
        missionId: target.mission.id,
        initialStep: target.step,
        startedAt: new Date().toISOString(),
      }),
    );
    navigate({ kind: 'mission', missionId: target.mission.id, step: target.step });
  }, [dispatch, navigate, target]);

  return {
    mode,
    ...(target !== undefined ? { target } : {}),
    label,
    missionText,
    progressText,
    completionPercent,
    open,
  };
}
