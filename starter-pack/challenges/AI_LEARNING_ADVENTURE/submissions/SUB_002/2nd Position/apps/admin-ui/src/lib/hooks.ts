import useSWR, { useSWRConfig } from 'swr';
import type { AdminContentItem, AdminContentListDto, AdminEntityType } from '@ai-learning-adventure/types';
import { adminApi, type AdminListParams } from './api.ts';

export function contentListKey(type: AdminEntityType, params: AdminListParams = {}): unknown[] {
  return ['admin', 'content', type, params];
}

export function contentItemKey(type: AdminEntityType, id: string): unknown[] {
  return ['admin', 'item', type, id];
}

export function useContentList(type: AdminEntityType, params: AdminListParams = {}) {
  const { data, error, isLoading, mutate } = useSWR<AdminContentListDto>(
    contentListKey(type, params),
    () => adminApi.list(type, params),
  );
  return { items: data?.items ?? [], total: data?.total ?? 0, error, isLoading, refresh: mutate };
}

export function useContentItem(type: AdminEntityType, id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AdminContentItem>(
    id === undefined ? null : contentItemKey(type, id),
    () => adminApi.get(type, id as string),
  );
  return { item: data, error, isLoading, refresh: mutate };
}

export function useRevalidateAll() {
  const { mutate } = useSWRConfig();
  return () => mutate(() => true, undefined, { revalidate: true });
}
