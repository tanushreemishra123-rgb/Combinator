import { vi } from 'vitest';
import type {
  CatalogDto,
  FlashcardRatingMutationDto,
  FlashcardRatingValue,
  IsoDateTime,
  MissionDetail,
  MissionStep,
  PortableProgressSnapshot,
  ProgressMutationDto,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import type { IntegrationApp } from '../harness.tsx';

interface ApiSuccess<T> {
  data: T;
}

interface ApiFailure {
  error?: { message?: string };
}

async function responseData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiSuccess<T> & ApiFailure;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Integration API returned HTTP ${response.status}.`);
  }
  return body.data;
}

export async function getProgress(
  runtime: IntegrationApp,
  learnerId = runtime.learnerId,
): Promise<ProgressSnapshotDto> {
  const response = await runtime.apiFetch(
    `${runtime.baseUrl}/api/v1/learners/${learnerId}/progress`,
  );
  return responseData<ProgressSnapshotDto>(response);
}

export async function getCatalog(runtime: IntegrationApp): Promise<CatalogDto> {
  const response = await runtime.apiFetch(`${runtime.baseUrl}/api/v1/catalog`);
  return responseData<CatalogDto>(response);
}

export async function getMission(runtime: IntegrationApp, missionId: string): Promise<MissionDetail> {
  const response = await runtime.apiFetch(`${runtime.baseUrl}/api/v1/missions/${missionId}`);
  const data = await responseData<{ mission: MissionDetail }>(response);
  return data.mission;
}

export async function importProgress(
  runtime: IntegrationApp,
  snapshot: PortableProgressSnapshot,
  learnerId = runtime.learnerId,
): Promise<ProgressSnapshotDto> {
  const response = await runtime.apiFetch(
    `${runtime.baseUrl}/api/v1/learners/${learnerId}/progress/import`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `integration-import-${crypto.randomUUID()}`,
        snapshot,
        mode: 'replace',
      }),
    },
  );
  return responseData<ProgressSnapshotDto>(response);
}

export async function resetProgress(
  runtime: IntegrationApp,
  learnerId = runtime.learnerId,
): Promise<ProgressSnapshotDto> {
  const response = await runtime.apiFetch(
    `${runtime.baseUrl}/api/v1/learners/${learnerId}/progress`,
    {
      method: 'DELETE',
      headers: { 'Idempotency-Key': `integration-reset-${crypto.randomUUID()}` },
    },
  );
  return responseData<ProgressSnapshotDto>(response);
}

export async function updateMissionProgress(
  runtime: IntegrationApp,
  missionId: string,
  input: {
    furthestStep: MissionStep;
    checkpointCompleted?: boolean;
    occurredAt?: IsoDateTime;
  },
  learnerId = runtime.learnerId,
): Promise<ProgressMutationDto> {
  const response = await runtime.apiFetch(
    `${runtime.baseUrl}/api/v1/learners/${learnerId}/missions/${missionId}/progress`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `integration-progress-${crypto.randomUUID()}`,
        furthestStep: input.furthestStep,
        ...(input.checkpointCompleted !== undefined
          ? { checkpointCompleted: input.checkpointCompleted }
          : {}),
        occurredAt: input.occurredAt ?? new Date().toISOString(),
      }),
    },
  );
  return responseData<ProgressMutationDto>(response);
}

export async function rateFlashcard(
  runtime: IntegrationApp,
  flashcardId: string,
  rating: FlashcardRatingValue,
  learnerId = runtime.learnerId,
): Promise<FlashcardRatingMutationDto> {
  const response = await runtime.apiFetch(
    `${runtime.baseUrl}/api/v1/learners/${learnerId}/flashcards/${flashcardId}/rating`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: `integration-rating-${crypto.randomUUID()}`,
        rating,
        occurredAt: new Date().toISOString(),
      }),
    },
  );
  return responseData<FlashcardRatingMutationDto>(response);
}

export function apiErrorResponse(
  status: number,
  code: string,
  message = 'Test-induced API failure.',
): Response {
  return new Response(
    JSON.stringify({ error: { code, message, requestId: 'test-request' } }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

interface Handler {
  predicate: (url: string, init?: RequestInit) => boolean;
  respond: (url: string, init?: RequestInit) => Promise<Response> | Response;
}

export interface ApiInterceptor {
  block: (
    predicate: (url: string, init?: RequestInit) => boolean,
    respond: (url: string, init?: RequestInit) => Promise<Response> | Response,
  ) => void;
  restore: () => void;
}

export function installApiInterceptor(runtime: IntegrationApp): ApiInterceptor {
  const handlers: Handler[] = [];
  const wrapper: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
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

