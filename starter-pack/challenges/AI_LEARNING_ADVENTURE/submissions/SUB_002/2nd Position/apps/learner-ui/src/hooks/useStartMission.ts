import { useCallback } from 'react';
import type { MissionSummary, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppDispatch } from '../store/index.ts';
import { startMission } from '../store/missionSessionSlice.ts';
import { useAppNavigation } from './useAppNavigation.ts';

export function useStartMission(progress: ProgressSnapshotDto) {
  const dispatch = useAppDispatch();
  const { navigate } = useAppNavigation();

  const openMission = useCallback(
    (mission: MissionSummary) => {
      const existing = progress.missions[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      const initialStep = existing?.status === 'in_progress' ? existing.furthestStep : 'lesson';
      dispatch(
        startMission({
          missionId: mission.id,
          initialStep,
          startedAt: new Date().toISOString(),
        }),
      );
      navigate({ kind: 'mission', missionId: mission.id, step: initialStep });
    },
    [dispatch, navigate, progress.missions],
  );

  return { openMission };
}
