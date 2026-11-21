/**
 * Browser storage for the workspace (spec "Deliverables 1. Working Application": sessions must
 * survive a reload) and the single-session import/export file pair. Every entry point here is
 * defensive: a missing, disabled or full browser storage, corrupt JSON, or an invalid session never
 * throws - callers always get a result they can turn into a UI notice.
 */
import { newUid } from '../domain';
import type { ScopingSession } from '../domain';
import { toWorkspaceJson } from '../export';
import { parseSession } from './sessionSchema';

/** localStorage key for the whole workspace (all sessions). Bump the suffix on a breaking format change. */
export const WORKSPACE_STORAGE_KEY = 'adsa.workspace.v1';

export interface LoadSessionsResult {
  sessions: ScopingSession[];
  /** User-friendly notices for anything skipped (corrupt JSON, unreadable storage, invalid entries). */
  issues: string[];
}

function readStoredSessions(): { entries: unknown[]; issue: string | null } {
  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (raw === null) {
    return { entries: [], issue: null };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { entries: [], issue: 'The saved workspace could not be read (it was not valid data) and has been reset.' };
  }
  if (!Array.isArray(parsedJson)) {
    return { entries: [], issue: 'The saved workspace was in an unexpected format and has been reset.' };
  }
  return { entries: parsedJson, issue: null };
}

/**
 * Loads every session saved in this browser. A corrupt entry is skipped (with a notice) rather than
 * discarding the whole workspace; a corrupt or missing top-level payload resets to an empty
 * workspace instead of throwing. `now` is the calculation timestamp for rebuilt estimates.
 */
export function loadSessions(now: string = new Date().toISOString()): LoadSessionsResult {
  try {
    const { entries, issue } = readStoredSessions();
    if (issue !== null) {
      return { sessions: [], issues: [issue] };
    }
    const sessions: ScopingSession[] = [];
    const issues: string[] = [];
    for (const entry of entries) {
      const result = parseSession(entry, now);
      if (result.ok) {
        sessions.push(result.session);
      } else {
        issues.push(`Skipped a saved session that could not be read (${result.errors.at(0) ?? 'unknown problem'}).`);
      }
    }
    return { sessions, issues };
  } catch {
    return { sessions: [], issues: ['Browser storage is unavailable, so saved sessions could not be loaded.'] };
  }
}

export interface SaveSessionsResult {
  ok: boolean;
  /** User-friendly explanation when `ok` is false (storage unavailable, quota exceeded, ...). */
  issue: string | null;
}

/** Persists every session. Never throws: storage being full, disabled or unavailable is reported, not raised. */
export function saveSessions(sessions: readonly ScopingSession[]): SaveSessionsResult {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(sessions));
    return { ok: true, issue: null };
  } catch {
    return {
      ok: false,
      issue: 'The workspace could not be saved (browser storage may be full or unavailable). Recent changes are only kept in this tab.',
    };
  }
}

/** Serialises one session as a downloadable workspace file. Never includes AI settings or API keys. */
export function exportWorkspaceFile(session: ScopingSession): string {
  return toWorkspaceJson(session);
}

export interface ImportWorkspaceSuccess {
  readonly ok: true;
  readonly session: ScopingSession;
}
export interface ImportWorkspaceFailure {
  readonly ok: false;
  readonly errors: string[];
}
export type ImportWorkspaceResult = ImportWorkspaceSuccess | ImportWorkspaceFailure;

/**
 * Validates an uploaded workspace file and assigns it a fresh id (`newUid()`) so importing a
 * session never collides with, or silently overwrites, one already open in this browser.
 */
export function importWorkspaceFile(text: string, now: string = new Date().toISOString()): ImportWorkspaceResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
  const result = parseSession(parsedJson, now);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }
  return { ok: true, session: { ...result.session, id: newUid() } };
}
