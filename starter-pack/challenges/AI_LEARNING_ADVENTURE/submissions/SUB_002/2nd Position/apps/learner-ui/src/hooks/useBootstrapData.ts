import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  CatalogDto,
  MissionProgressStatus,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import { deriveProgressProjection } from '@ai-learning-adventure/learner';
import { useAppDispatch } from '../store/index.ts';
import { hydrateProjection } from '../store/progressProjectionSlice.ts';
import { useCatalog } from './api/useCatalog.ts';
import { useProgress } from './api/useProgress.ts';
import type { ApiRequestError } from './api/client.ts';

export interface UseBootstrapDataResult {
  catalog?: CatalogDto;
  progress?: ProgressSnapshotDto;
  isReady: boolean;
  error?: ApiRequestError;
  retry: () => void;
}

export function useBootstrapData(learnerId?: string): UseBootstrapDataResult {
  const dispatch = useAppDispatch();
  const { catalog, error: catalogError, refresh: refreshCatalog } = useCatalog();
  const { snapshot, error: progressError, refresh: refreshProgress } = useProgress(learnerId);

  const isReady = catalog !== undefined && snapshot !== undefined;

  const projection = useMemo(
    () =>
      catalog !== undefined && snapshot !== undefined
        ? deriveProgressProjection(catalog, snapshot)
        : undefined,
    [catalog, snapshot],
  );

  const hydratedRevisionRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (catalog === undefined || snapshot === undefined || projection === undefined) return;
    const revisionKey = `${catalog.contentVersion}:${snapshot.revision}`;
    if (hydratedRevisionRef.current === revisionKey) return;
    hydratedRevisionRef.current = revisionKey;
    const missionStatuses: Record<string, MissionProgressStatus> = {};
    for (const mission of catalog.missions) {
      missionStatuses[mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = snapshot.missions[mission.id]?.status ?? 'not_started';
    }
    dispatch(
      hydrateProjection({
        projection,
        missionStatuses,
        earnedAwardIds: snapshot.earnedAwards.map((award) => award.awardId),
      }),
    );
  }, [catalog, snapshot, projection, dispatch]);

  const retry = useCallback(() => {
    void refreshCatalog();
    void refreshProgress();
  }, [refreshCatalog, refreshProgress]);

  return {
    catalog,
    progress: snapshot,
    isReady,
    error: catalogError ?? progressError,
    retry,
  };
}
