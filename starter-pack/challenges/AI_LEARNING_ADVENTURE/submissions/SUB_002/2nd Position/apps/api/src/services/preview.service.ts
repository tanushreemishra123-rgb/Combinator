import { randomUUID } from 'node:crypto';
import type { PreviewPayloadDto } from '@ai-learning-adventure/types';

interface PreviewSession {
  payload: PreviewPayloadDto;
  expiresAt: number;
}

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 50;

const sessions = new Map<string, PreviewSession>();

export function createPreviewSession(payload: PreviewPayloadDto): string {
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest !== undefined) sessions.delete(oldest);
  }
  const token = randomUUID();
  sessions.set(token, { payload, expiresAt: Date.now() + PREVIEW_TTL_MS });
  return token;
}

export function getPreviewSession(token: string): PreviewPayloadDto | undefined {
  const session = sessions.get(token);
  if (session === undefined) return undefined;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session.payload;
}
