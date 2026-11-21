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
  PracticeAssignmentChange,
} from '@ai-learning-adventure/types';

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = `/api/v1${safePath}`;
  try {
    // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf
    response = await fetch(url, {
      ...init,
      headers: { accept: 'application/json', ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    });
  } catch (cause) {
    throw new AdminApiError(0, 'network_error', 'Unable to reach the API.');
  }
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  if (!response.ok) {
    const error = (parsed as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new AdminApiError(
      response.status,
      error?.code ?? 'http_error',
      error?.message ?? `Request failed with status ${response.status}.`,
    );
  }
  return (parsed as { data: T }).data;
}

function queryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries as Array<[string, string]>).toString()}`;
}

export interface AdminListParams {
  status?: string;
  missionId?: string;
  difficulty?: string;
  levelTrack?: string;
  q?: string;
}

export const adminApi = {
  list(type: AdminEntityType, params: AdminListParams = {}): Promise<AdminContentListDto> {
    return request<AdminContentListDto>(`/admin/content${queryString({ type, ...params })}`);
  },
  get(type: AdminEntityType, id: string): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}/${encodeURIComponent(id)}`);
  },
  create(type: AdminEntityType, body: Record<string, unknown> = {}): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}`, { method: 'POST', body: JSON.stringify(body) });
  },
  save(
    type: AdminEntityType,
    id: string,
    doc: unknown,
    expectedRevision: number,
    lenient = false,
  ): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ doc, expectedRevision, lenient }),
    });
  },
  archive(type: AdminEntityType, id: string): Promise<{ archived: boolean }> {
    return request<{ archived: boolean }>(`/admin/content/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  duplicate(type: AdminEntityType, id: string): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
  },
  validation(type: AdminEntityType, id: string): Promise<AdminValidationReport> {
    return request<AdminValidationReport>(`/admin/content/${type}/${encodeURIComponent(id)}/validation`);
  },
  history(type: AdminEntityType, id: string): Promise<AdminPublishHistoryEntry[]> {
    return request<AdminPublishHistoryEntry[]>(`/admin/content/${type}/${encodeURIComponent(id)}/history`);
  },
  setEnabled(type: AdminEntityType, id: string, enabled: boolean): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}/${encodeURIComponent(id)}/enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
  publish(
    type: AdminEntityType,
    id: string,
    input: { acknowledgement: boolean; note?: string; expectedRevision: number; includeDependentDrafts?: boolean },
  ): Promise<AdminPublishResult> {
    return request<AdminPublishResult>(`/admin/content/${type}/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  unpublish(type: AdminEntityType, id: string, note?: string): Promise<AdminContentItem> {
    return request<AdminContentItem>(`/admin/content/${type}/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
      body: JSON.stringify(note === undefined ? {} : { note }),
    });
  },
  bulk(
    action: 'enable' | 'disable' | 'publish' | 'unpublish',
    refs: Array<{ entityType: AdminEntityType; id: string }>,
    acknowledgement = true,
  ): Promise<AdminBulkActionResult> {
    return request<AdminBulkActionResult>('/admin/content/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, refs, acknowledgement }),
    });
  },
  practiceAssignments(changes: PracticeAssignmentChange[]): Promise<{ items: AdminContentItem[] }> {
    return request<{ items: AdminContentItem[] }>('/admin/practice-assignments', {
      method: 'PATCH',
      body: JSON.stringify({ changes }),
    });
  },
  reorderMissions(levelTrack: string, orderedMissionIds: string[]): Promise<{ reordered: boolean }> {
    return request<{ reordered: boolean }>('/admin/missions/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ levelTrack, orderedMissionIds }),
    });
  },
  exportBundle(): Promise<AdminContentBundle> {
    return request<AdminContentBundle>('/admin/content/export');
  },
  importBundle(
    bundle: AdminContentBundle,
    mode: 'merge' | 'replace',
    dryRun: boolean,
  ): Promise<AdminImportReport> {
    return request<AdminImportReport>('/admin/content/import', {
      method: 'POST',
      body: JSON.stringify({ bundle, mode, dryRun }),
    });
  },
  seedStatus(): Promise<AdminSeedStatusDto> {
    return request<AdminSeedStatusDto>('/admin/seed');
  },
  reloadSeed(): Promise<AdminSeedStatusDto> {
    return request<AdminSeedStatusDto>('/admin/seed/reload', { method: 'POST' });
  },
  createPreview(missionId: string): Promise<{ token: string; learnerUrl: string }> {
    return request<{ token: string; learnerUrl: string }>('/admin/preview', {
      method: 'POST',
      body: JSON.stringify({ missionId }),
    });
  },
};
