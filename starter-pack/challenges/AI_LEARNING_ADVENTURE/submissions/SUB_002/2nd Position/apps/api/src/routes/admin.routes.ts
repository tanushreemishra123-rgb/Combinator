import type { IncomingMessage } from 'node:http';
import type {
  AdminBulkActionRequest,
  AdminImportRequest,
  AdminPublishRequest,
  AdminSaveRequest,
  AdminUnpublishRequest,
  LevelTrack,
  MissionReorderRequest,
  PracticeAssignmentsRequest,
} from '@ai-learning-adventure/types';
import type { ApiContext } from '../context.ts';
import { badRequest, methodNotAllowed } from '../http/errors.ts';
import { optionalBoolean, readJsonBody, requireInteger, requireString } from '../http/response.ts';
import * as adminService from '../services/admin.service.ts';
import * as previewService from '../services/preview.service.ts';

const ADMIN_BODY_LIMIT = 2 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return readJsonBody(req, ADMIN_BODY_LIMIT);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export interface AdminRouteResult {
  data: unknown;
}

export async function handleAdminRoute(
  ctx: ApiContext,
  req: IncomingMessage,
  method: string,
  rest: string[],
  url: URL,
): Promise<AdminRouteResult> {
  const db = ctx.dbHandle.db;

  if (rest.length === 1 && rest[0] === 'content') {
    if (method !== 'GET') throw methodNotAllowed();
    const type = adminService.requireEntityType(url.searchParams.get('type') ?? '');
    return {
      data: adminService.listContent(db, {
        type,
        status: optionalString(url.searchParams.get('status')),
        missionId: optionalString(url.searchParams.get('missionId')),
        difficulty: optionalString(url.searchParams.get('difficulty')),
        levelTrack: optionalString(url.searchParams.get('levelTrack')),
        q: optionalString(url.searchParams.get('q')),
        includeArchived: url.searchParams.get('includeArchived') === 'true',
      }),
    };
  }

  if (rest.length === 2 && rest[0] === 'content' && rest[1] === 'bulk') {
    if (method !== 'POST') throw methodNotAllowed();
    const body = await readBody(req);
    const request = body as unknown as AdminBulkActionRequest;
    if (!Array.isArray(request.refs)) throw badRequest('Field "refs" must be an array.');
    return { data: adminService.bulkAction(db, request) };
  }

  if (rest.length === 2 && rest[0] === 'content' && rest[1] === 'import') {
    if (method !== 'POST') throw methodNotAllowed();
    const body = await readBody(req);
    const request = body as unknown as AdminImportRequest;
    const mode = request.mode === 'replace' ? 'replace' : 'merge';
    return { data: adminService.importBundle(db, request.bundle, mode, request.dryRun === true) };
  }

  if (rest.length === 2 && rest[0] === 'content' && rest[1] === 'export') {
    if (method !== 'GET') throw methodNotAllowed();
    return { data: adminService.exportBundle(db) };
  }

  if (rest.length === 2 && rest[0] === 'content') {
    const type = adminService.requireEntityType(rest[1]!);
    if (method === 'GET') {
      return { data: adminService.listContent(db, { type }) };
    }
    if (method === 'POST') {
      const body = await readBody(req);
      return {
        data: adminService.createContent(db, type, {
          id: optionalString(body.id),
          slug: optionalString(body.slug),
        }),
      };
    }
    throw methodNotAllowed();
  }

  if (rest.length >= 3 && rest[0] === 'content') {
    const type = adminService.requireEntityType(rest[1]!);
    const id = rest[2]!;
    const action = rest[3];

    if (action === undefined) {
      if (method === 'GET') return { data: adminService.getContent(db, type, id) };
      if (method === 'PUT') {
        const body = await readBody(req);
        const save = body as unknown as AdminSaveRequest;
        const expectedRevision = requireInteger(save.expectedRevision, 'expectedRevision');
        const lenient = optionalBoolean(body.lenient, 'lenient') === true;
        return { data: adminService.saveContent(db, type, id, save.doc, expectedRevision, { lenient }) };
      }
      if (method === 'DELETE') {
        adminService.archiveContent(db, type, id);
        return { data: { archived: true } };
      }
      throw methodNotAllowed();
    }

    if (action === 'duplicate' && method === 'POST') {
      return { data: adminService.duplicateContent(db, type, id) };
    }
    if (action === 'validation' && method === 'GET') {
      return { data: adminService.validationReportFor(db, type, id) };
    }
    if (action === 'history' && method === 'GET') {
      return { data: adminService.getPublishHistory(db, type, id) };
    }
    if (action === 'enabled' && method === 'PATCH') {
      const body = await readBody(req);
      const enabled = optionalBoolean(body.enabled, 'enabled');
      if (enabled === undefined) throw badRequest('Field "enabled" must be a boolean.');
      return { data: adminService.setEnabled(db, type, id, enabled) };
    }
    if (action === 'publish' && method === 'POST') {
      const body = await readBody(req);
      const request = body as unknown as AdminPublishRequest;
      return {
        data: adminService.publishContent(db, type, id, {
          acknowledgement: request.acknowledgement === true,
          note: optionalString(request.note),
          expectedRevision: requireInteger(request.expectedRevision, 'expectedRevision'),
          includeDependentDrafts: request.includeDependentDrafts === true,
        }),
      };
    }
    if (action === 'unpublish' && method === 'POST') {
      const body = await readBody(req);
      const request = body as unknown as AdminUnpublishRequest;
      return { data: adminService.unpublishContent(db, type, id, { note: optionalString(request.note) }) };
    }
    throw methodNotAllowed();
  }

  if (rest.length === 1 && rest[0] === 'practice-assignments') {
    if (method !== 'PATCH') throw methodNotAllowed();
    const body = await readBody(req);
    const request = body as unknown as PracticeAssignmentsRequest;
    if (!Array.isArray(request.changes)) throw badRequest('Field "changes" must be an array.');
    return { data: { items: adminService.applyPracticeAssignments(db, request.changes) } };
  }

  if (rest.length === 2 && rest[0] === 'missions' && rest[1] === 'reorder') {
    if (method !== 'PATCH') throw methodNotAllowed();
    const body = await readBody(req);
    const request = body as unknown as MissionReorderRequest;
    if (!Array.isArray(request.orderedMissionIds)) {
      throw badRequest('Field "orderedMissionIds" must be an array.');
    }
    adminService.reorderMissions(db, request.levelTrack as LevelTrack, request.orderedMissionIds);
    return { data: { reordered: true } };
  }

  if (rest.length === 1 && rest[0] === 'seed') {
    if (method !== 'GET') throw methodNotAllowed();
    return { data: adminService.seedStatus(db) };
  }

  if (rest.length === 2 && rest[0] === 'seed' && rest[1] === 'reload') {
    if (method !== 'POST') throw methodNotAllowed();
    return { data: adminService.reloadSeed(db, ctx.config.missionDataDir) };
  }

  if (rest.length === 1 && rest[0] === 'preview') {
    if (method !== 'POST') throw methodNotAllowed();
    const body = await readBody(req);
    const missionId = requireString(body.missionId, 'missionId', 128);
    const payload = adminService.buildPreviewPayload(db, missionId);
    const token = previewService.createPreviewSession(payload);
    return { data: { token, learnerUrl: '' } };
  }

  throw badRequest('Unknown admin route.');
}

export function handlePreviewLookup(ctx: ApiContext, token: string): unknown {
  void ctx;
  const payload = previewService.getPreviewSession(token);
  if (payload === undefined) {
    throw badRequest('This preview link is no longer valid. Open the preview from the admin app again.');
  }
  return payload;
}
