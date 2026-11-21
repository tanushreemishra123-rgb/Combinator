import { vi } from 'vitest';
import type {
  AdminBulkActionResult,
  AdminContentBundle,
  AdminContentItem,
  AdminContentListDto,
  AdminEntityType,
  AdminImportReport,
  AdminPublishHistoryEntry,
  AdminPublishResult,
  AdminSeedStatusDto,
  AdminValidationReport,
  LevelTrack,
  PracticeAssignmentChange,
} from '@ai-learning-adventure/types';
import type { AdminIntegrationRuntime } from '../harness.tsx';

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

export async function responseData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? `Integration API returned HTTP ${response.status}.`);
  }
  return body.data;
}

async function apiRequest<T>(
  runtime: AdminIntegrationRuntime,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await runtime.apiFetch(`${runtime.baseUrl}/api/v1${path}`, init);
  return responseData<T>(response);
}

function queryString(params: Record<string, string | boolean | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}

export function listContent<T = unknown>(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  params: Record<string, string | boolean | undefined> = {},
): Promise<AdminContentListDto<T>> {
  return apiRequest(runtime, `/admin/content${queryString({ type: entityType, ...params })}`);
}

export function getContent<T = unknown>(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<AdminContentItem<T>> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}`);
}

export function createContent(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
): Promise<AdminContentItem> {
  return apiRequest(runtime, `/admin/content/${entityType}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

export function saveContent<T>(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
  doc: T,
  expectedRevision: number,
  lenient = false,
): Promise<AdminContentItem<T>> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ doc, expectedRevision, lenient }),
  });
}

export async function createValidDraft<T>(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  buildDoc: (id: string) => T,
): Promise<AdminContentItem<T>> {
  const created = await createContent(runtime, entityType);
  return saveContent(runtime, entityType, created.id, buildDoc(created.id), created.revision);
}

export function setEnabled(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
  enabled: boolean,
): Promise<AdminContentItem> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}/enabled`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export function archiveContent(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<{ archived: boolean }> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function duplicateContent(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<AdminContentItem> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
}

export function validationReport(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<AdminValidationReport> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}/validation`);
}

export function publishContent(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  item: Pick<AdminContentItem, 'id' | 'revision'>,
  includeDependentDrafts = false,
): Promise<AdminPublishResult> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(item.id)}/publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      acknowledgement: true,
      expectedRevision: item.revision,
      includeDependentDrafts,
    }),
  });
}

export function unpublishContent(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<AdminContentItem> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

export function publishHistory(
  runtime: AdminIntegrationRuntime,
  entityType: AdminEntityType,
  id: string,
): Promise<AdminPublishHistoryEntry[]> {
  return apiRequest(runtime, `/admin/content/${entityType}/${encodeURIComponent(id)}/history`);
}

export function bulkAction(
  runtime: AdminIntegrationRuntime,
  action: 'enable' | 'disable' | 'publish' | 'unpublish',
  refs: Array<{ entityType: AdminEntityType; id: string }>,
): Promise<AdminBulkActionResult> {
  return apiRequest(runtime, '/admin/content/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, refs, acknowledgement: true }),
  });
}

export function applyAssignments(
  runtime: AdminIntegrationRuntime,
  changes: PracticeAssignmentChange[],
): Promise<{ items: AdminContentItem[] }> {
  return apiRequest(runtime, '/admin/practice-assignments', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ changes }),
  });
}

export function reorderMissions(
  runtime: AdminIntegrationRuntime,
  levelTrack: LevelTrack,
  orderedMissionIds: string[],
): Promise<{ reordered: boolean }> {
  return apiRequest(runtime, '/admin/missions/reorder', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ levelTrack, orderedMissionIds }),
  });
}

export function exportBundle(runtime: AdminIntegrationRuntime): Promise<AdminContentBundle> {
  return apiRequest(runtime, '/admin/content/export');
}

export function importBundle(
  runtime: AdminIntegrationRuntime,
  bundle: AdminContentBundle,
  mode: 'merge' | 'replace',
  dryRun: boolean,
): Promise<AdminImportReport> {
  return apiRequest(runtime, '/admin/content/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundle, mode, dryRun }),
  });
}

export function seedStatus(runtime: AdminIntegrationRuntime): Promise<AdminSeedStatusDto> {
  return apiRequest(runtime, '/admin/seed');
}

export function reloadSeed(runtime: AdminIntegrationRuntime): Promise<AdminSeedStatusDto> {
  return apiRequest(runtime, '/admin/seed/reload', { method: 'POST' });
}

export function apiErrorResponse(
  status: number,
  code: string,
  message = 'Test-induced API failure.',
): Response {
  return new Response(JSON.stringify({ error: { code, message, requestId: 'admin-integration' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Handler {
  predicate: (url: string, init?: RequestInit) => boolean;
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface ApiInterceptor {
  block: (handler: Handler['predicate'], respond: Handler['respond']) => void;
  restore: () => void;
}

export function installApiInterceptor(runtime: AdminIntegrationRuntime): ApiInterceptor {
  const handlers: Handler[] = [];
  const wrapper: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const handler of [...handlers].reverse()) {
      if (handler.predicate(url, init)) return handler.respond(url, init);
    }
    return runtime.apiFetch(input as RequestInfo | URL, init);
  };
  vi.stubGlobal('fetch', wrapper);
  return {
    block: (predicate, respond) => handlers.push({ predicate, respond }),
    restore: () => vi.stubGlobal('fetch', runtime.apiFetch),
  };
}
