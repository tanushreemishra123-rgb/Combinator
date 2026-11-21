import useSWR, { type KeyedMutator } from 'swr';
import type { ApiResponse, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { apiClient, type ApiRequestError } from './client.ts';
import { apiKeys } from './keys.ts';

export interface UseProgressResult {
  snapshot?: ProgressSnapshotDto;
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: KeyedMutator<ApiResponse<ProgressSnapshotDto>>;
}

export function useProgress(learnerId?: string): UseProgressResult {
  const key = learnerId ? apiKeys.progress(learnerId) : null;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ProgressSnapshotDto>, ApiRequestError>(
    key,
    apiClient,
  );
  return { snapshot: data?.data, isLoading, error, refresh: mutate };
}
