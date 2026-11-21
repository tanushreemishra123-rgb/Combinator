import useSWR, { type KeyedMutator } from 'swr';
import type { ApiResponse, CatalogDto } from '@ai-learning-adventure/types';
import { apiClient, type ApiRequestError } from './client.ts';
import { apiKeys } from './keys.ts';

export interface UseCatalogResult {
  catalog?: CatalogDto;
  isLoading: boolean;
  error?: ApiRequestError;
  refresh: KeyedMutator<ApiResponse<CatalogDto>>;
}

export function useCatalog(): UseCatalogResult {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<CatalogDto>, ApiRequestError>(
    apiKeys.catalog(),
    apiClient,
    { revalidateOnMount: true, dedupingInterval: 0 },
  );
  return { catalog: data?.data, isLoading, error, refresh: mutate };
}
