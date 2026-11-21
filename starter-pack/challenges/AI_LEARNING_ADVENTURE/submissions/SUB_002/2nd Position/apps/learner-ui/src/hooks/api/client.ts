import type { ApiErrorBody, ApiResponse } from '@ai-learning-adventure/types';
import {
  getPreviewCatalog,
  getPreviewMission,
  getPreviewSnapshot,
  isPreviewMode,
} from '../../preview/previewMode.ts';

export interface ApiRequestErrorOptions {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  cause?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(options: ApiRequestErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export interface MutationFetcherOptions<Body> {
  arg: Body;
}

const DEFAULT_BASE_URL = '/api/v1';

function resolveBaseUrl(): string {
  const meta = import.meta as ImportMeta & { env?: Readonly<Record<string, string | undefined>> };
  const configured = meta.env?.VITE_API_BASE_URL;
  if (configured === undefined || configured.length === 0) {
    return DEFAULT_BASE_URL;
  }
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

async function toApiError(response: Response): Promise<ApiRequestError> {
  let code = 'http_error';
  let message = `Request failed with status ${response.status}.`;
  let requestId: string | undefined;
  try {
    const body = (await response.json()) as Partial<ApiErrorBody> | null;
    const error = body?.error;
    if (error) {
      if (typeof error.code === 'string' && error.code.length > 0) code = error.code;
      if (typeof error.message === 'string' && error.message.length > 0) message = error.message;
      if (typeof error.requestId === 'string' && error.requestId.length > 0) requestId = error.requestId;
    }
  } catch {
    code = response.status >= 500 ? 'server_error' : 'http_error';
  }
  return new ApiRequestError({ status: response.status, code, message, requestId });
}

async function request<Data>(path: string, init: RequestInit): Promise<ApiResponse<Data>> {
  let response: Response;
  const baseUrl = resolveBaseUrl();
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${safePath}`;
  try {
    // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf
    response = await fetch(url, init);
  } catch (cause) {
    throw new ApiRequestError({
      status: 0,
      code: 'network_error',
      message: 'Unable to reach the learning API.',
      cause,
    });
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  try {
    return (await response.json()) as ApiResponse<Data>;
  } catch (cause) {
    throw new ApiRequestError({
      status: response.status,
      code: 'invalid_response',
      message: 'The learning API returned an unexpected response.',
      cause,
    });
  }
}

const JSON_HEADERS: Record<string, string> = {
  accept: 'application/json',
  'content-type': 'application/json',
};

export function apiClient<Data>(path: string): Promise<ApiResponse<Data>> {
  const previewResponse = previewResponseFor<Data>(path);
  if (previewResponse !== undefined) {
    return Promise.resolve(previewResponse);
  }
  return request<Data>(path, { method: 'GET', headers: { accept: 'application/json' } });
}

function previewResponseFor<Data>(path: string): ApiResponse<Data> | undefined {
  if (!isPreviewMode()) return undefined;
  const meta = { requestId: 'preview' };
  if (path === '/catalog') {
    const catalog = getPreviewCatalog();
    if (catalog === undefined) return undefined;
    return { data: catalog as Data, meta };
  }
  const missionMatch = /^\/missions\/([^/]+)$/.exec(path);
  if (missionMatch !== null) {
    const mission = getPreviewMission();
    if (mission === undefined) return undefined;
    const requested = decodeURIComponent(missionMatch[1]!);
    if (requested !== (mission.id as string)) return undefined;
    return { data: { mission } as Data, meta };
  }
  if (path.endsWith('/progress')) {
    const snapshot = getPreviewSnapshot();
    if (snapshot === undefined) return undefined;
    return { data: snapshot as Data, meta };
  }
  return undefined;
}

export function postJson<Data, Body>(
  path: string,
  options: MutationFetcherOptions<Body>,
): Promise<ApiResponse<Data>> {
  return request<Data>(path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(options.arg) });
}

export function putJson<Data, Body>(
  path: string,
  options: MutationFetcherOptions<Body>,
): Promise<ApiResponse<Data>> {
  return request<Data>(path, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(options.arg) });
}

export function deleteJson<Data>(
  path: string,
  options: MutationFetcherOptions<{ idempotencyKey: string }>,
): Promise<ApiResponse<Data>> {
  return request<Data>(path, {
    method: 'DELETE',
    headers: { accept: 'application/json', 'idempotency-key': options.arg.idempotencyKey },
  });
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
