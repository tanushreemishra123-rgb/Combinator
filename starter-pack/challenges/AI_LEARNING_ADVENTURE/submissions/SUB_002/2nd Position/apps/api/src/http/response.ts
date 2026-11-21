import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiErrorBody, ApiResponse, IsoDateTime } from '@ai-learning-adventure/types';
import { ApiHttpError, badRequest } from './errors.ts';

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function sendSuccess<T>(res: ServerResponse, data: T, requestId: string, etag?: string): void {
  const body: ApiResponse<T> = {
    data,
    meta: { requestId, ...(etag ? { etag } : {}) },
  };
  sendJson(res, 200, body);
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  requestId: string,
): void {
  const body: ApiErrorBody = { error: { code, message, requestId } };
  sendJson(res, status, body);
}

export async function readJsonBody(req: IncomingMessage, limitBytes: number): Promise<Record<string, unknown>> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiHttpError(415, 'unsupported_media_type', 'Request body must use content-type application/json.');
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    received += buffer.length;
    if (received > limitBytes) {
      throw new ApiHttpError(413, 'payload_too_large', 'Request body exceeds the size limit.');
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    throw badRequest('A JSON request body is required.');
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw badRequest('Request body must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    throw badRequest('Request body must be valid JSON.');
  }
}

export function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest(`Field "${field}" must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, field: string, maxLength = 512): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw badRequest(`Field "${field}" must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value;
}

export function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw badRequest(`Field "${field}" must be an array of strings.`);
  }
  return value as string[];
}

export function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest(`Field "${field}" must be an integer.`);
  }
  return value;
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw badRequest(`Field "${field}" must be a boolean.`);
  }
  return value;
}

export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw badRequest(`Field "${field}" must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function requireIsoDateTime(value: unknown, field: string): IsoDateTime {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw badRequest(`Field "${field}" must be an ISO-8601 date-time string.`);
  }
  return value as IsoDateTime;
}
