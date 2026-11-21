import { useMemo } from 'react';
import useSWR from 'swr';
import type {
  ApiResponse,
  CatalogDto,
  MissionDetail,
  MissionDetailDto,
} from '@ai-learning-adventure/types';
import { apiClient, type ApiRequestError } from '../../../hooks/api/client.ts';
import { apiKeys } from '../../../hooks/api/keys.ts';

export interface UsePublishedMissionDetailsResult {
  missions: MissionDetail[];
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: () => void;
}

export function usePublishedMissionDetails(
  catalog: CatalogDto,
): UsePublishedMissionDetailsResult {
  const missionIds = useMemo(
    () => catalog.missions.map((mission) => mission.id),
    [catalog.missions],
  );
  const key = `ai-only:published-missions:${catalog.contentVersion}:${missionIds.join('|')}`;
  const { data, error, isLoading, mutate } = useSWR<
    Array<ApiResponse<MissionDetailDto>>,
    ApiRequestError
  >(key, async () => {
    const results = await Promise.all(
      missionIds.map(async (missionId) => {
        try {
          return await apiClient<MissionDetailDto>(apiKeys.mission(missionId));
        } catch {
          return undefined;
        }
      }),
    );
    const available = results.filter(
      (result): result is ApiResponse<MissionDetailDto> => result !== undefined,
    );
    if (available.length === 0 && missionIds.length > 0) {
      throw new Error('No published mission details could be loaded.');
    }
    return available;
  });
  const byId = useMemo(
    () => new Map((data ?? []).map((result) => [result.data.mission.id, result.data.mission])),
    [data],
  );
  const missions = useMemo(
    () => missionIds.flatMap((missionId) => {
      const mission = byId.get(missionId);
      return mission === undefined ? [] : [mission];
    }),
    [byId, missionIds],
  );

  return {
    missions,
    isLoading,
    ...(error !== undefined ? { error } : {}),
    refresh: () => {
      void mutate();
    },
  };
}
