import useSWR, { useSWRConfig, type KeyedMutator } from 'swr';
import type { ApiResponse, MissionDetail, MissionDetailDto, MissionId } from '@ai-learning-adventure/types';
import { apiClient, type ApiRequestError } from './client.ts';
import { apiKeys } from './keys.ts';

export interface UseMissionResult {
  mission?: MissionDetail;
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: KeyedMutator<ApiResponse<MissionDetailDto>>;
}

export function useMission(missionId?: MissionId): UseMissionResult {
  const key = missionId ? apiKeys.mission(missionId) : null;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<MissionDetailDto>, ApiRequestError>(
    key,
    apiClient,
    { revalidateOnMount: true, dedupingInterval: 0 },
  );
  return { mission: data?.data.mission, isLoading, error, refresh: mutate };
}
