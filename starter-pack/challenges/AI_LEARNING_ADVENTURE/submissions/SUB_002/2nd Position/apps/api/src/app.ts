import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HealthDto } from '@ai-learning-adventure/types';
import type { ApiConfig } from './config.ts';
import type { ApiContext } from './context.ts';
import { openDatabase, type DatabaseHandle } from './db/client.ts';
import { seedFromMissionData, type SeedResult } from './db/seed.ts';
import { ApiHttpError, badRequest, methodNotAllowed, notFound } from './http/errors.ts';
import { sendError, sendSuccess } from './http/response.ts';
import { handleAdminRoute, handlePreviewLookup } from './routes/admin.routes.ts';
import { handleGetCatalog } from './routes/catalog.routes.ts';
import { handleGetMission } from './routes/mission.routes.ts';
import {
  handleGetProgress,
  handleImportProgress,
  handleRateFlashcard,
  handleRecordQuizAttempt,
  handleResetProgress,
  handleUpdateMissionProgress,
} from './routes/progress.routes.ts';
import * as adminService from './services/admin.service.ts';

export interface App {
  handler: (req: IncomingMessage, res: ServerResponse) => void;
  dbHandle: DatabaseHandle;
  seedResult: SeedResult;
  close: () => void;
}

interface RouteResult {
  data: unknown;
  etag?: string;
}

function decodeSegment(value: string | undefined, field: string): string {
  if (value === undefined) throw notFound('Unknown API route.');
  try {
    return decodeURIComponent(value);
  } catch {
    throw badRequest(`Path segment "${field}" is not a valid URL-encoded value.`);
  }
}

function requireLearnerId(value: string): string {
  if (value.trim().length === 0 || value.length > 128) {
    throw badRequest('Path segment "learnerId" must be a non-empty string of at most 128 characters.');
  }
  return value;
}

export function createApp(config: ApiConfig): App {
  const dbHandle = openDatabase(config.databaseFile);
  const seedResult = seedFromMissionData(dbHandle.db, config.missionDataDir);
  adminService.backfillContentItems(dbHandle.db);
  const ctx: ApiContext = { dbHandle, config };

  async function route(req: IncomingMessage, url: URL): Promise<RouteResult> {
    const method = req.method ?? 'GET';
    const segments = url.pathname.split('/').filter((segment) => segment.length > 0);

    if (segments[0] !== 'api' || segments[1] !== 'v1') {
      throw notFound('Unknown API route.');
    }
    const rest = segments.slice(2);

    if (rest.length === 1 && rest[0] === 'health') {
      if (method !== 'GET') throw methodNotAllowed();
      dbHandle.sqlite.prepare('SELECT 1 AS ok').get();
      const data: HealthDto = { status: 'ok', database: 'ok' };
      return { data };
    }

    if (rest.length === 1 && rest[0] === 'catalog') {
      if (method !== 'GET') throw methodNotAllowed();
      const { dto, etag } = handleGetCatalog(ctx, url);
      return { data: dto, etag };
    }

    if (rest.length === 2 && rest[0] === 'missions') {
      if (method !== 'GET') throw methodNotAllowed();
      const missionId = decodeSegment(rest[1], 'missionId');
      return { data: handleGetMission(ctx, missionId) };
    }

    if (rest[0] === 'admin') {
      return await handleAdminRoute(ctx, req, method, rest.slice(1), url);
    }

    if (rest.length === 2 && rest[0] === 'preview') {
      if (method !== 'GET') throw methodNotAllowed();
      const token = decodeSegment(rest[1], 'previewToken');
      return { data: handlePreviewLookup(ctx, token) };
    }

    if (rest[0] === 'learners' && rest.length >= 3) {
      const learnerId = requireLearnerId(decodeSegment(rest[1], 'learnerId'));
      const tail = rest.slice(2);

      if (tail.length === 1 && tail[0] === 'progress') {
        if (method === 'GET') {
          return { data: handleGetProgress(ctx, learnerId) };
        }
        if (method === 'DELETE') {
          return { data: await handleResetProgress(ctx, req, learnerId) };
        }
        throw methodNotAllowed();
      }

      if (tail.length === 3 && tail[0] === 'missions' && tail[2] === 'progress') {
        if (method !== 'PUT') throw methodNotAllowed();
        const missionId = decodeSegment(tail[1], 'missionId');
        return { data: await handleUpdateMissionProgress(ctx, req, learnerId, missionId) };
      }

      if (tail.length === 1 && tail[0] === 'quiz-attempts') {
        if (method !== 'POST') throw methodNotAllowed();
        return { data: await handleRecordQuizAttempt(ctx, req, learnerId) };
      }

      if (tail.length === 3 && tail[0] === 'flashcards' && tail[2] === 'rating') {
        if (method !== 'PUT') throw methodNotAllowed();
        const flashcardId = decodeSegment(tail[1], 'flashcardId');
        return { data: await handleRateFlashcard(ctx, req, learnerId, flashcardId) };
      }

      if (tail.length === 2 && tail[0] === 'progress' && tail[1] === 'import') {
        if (method !== 'POST') throw methodNotAllowed();
        return { data: await handleImportProgress(ctx, req, learnerId) };
      }
    }

    throw notFound('Unknown API route.');
  }

  function applyCorsHeaders(res: ServerResponse): void {
    res.setHeader('access-control-allow-origin', config.corsOrigin);
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, idempotency-key');
    res.setHeader('access-control-expose-headers', 'etag');
    res.setHeader('access-control-max-age', '600');
    res.setHeader('vary', 'origin');
  }

  function handler(req: IncomingMessage, res: ServerResponse): void {
    const requestId = randomUUID();
    applyCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let url: URL;
    try {
      url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    } catch {
      sendError(res, 400, 'validation_error', 'Request URL is invalid.', requestId);
      return;
    }

    route(req, url).then(
      (result) => {
        sendSuccess(res, result.data, requestId, result.etag);
      },
      (error: unknown) => {
        if (error instanceof ApiHttpError) {
          sendError(res, error.status, error.code, error.message, requestId);
          return;
        }
        console.error('[api] unexpected error', error);
        sendError(res, 500, 'internal_error', 'Unexpected server error.', requestId);
      },
    );
  }

  return {
    handler,
    dbHandle,
    seedResult,
    close: () => dbHandle.close(),
  };
}
