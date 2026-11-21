/**
 * Session lifecycle use cases: create, rename, select, delete, delete-everything and import. Every
 * function is a plain call against `UseCaseDeps` (see `../types.ts`), so it needs no React to test.
 */
import { createSession, newUid } from '../../domain';
import type { ScopingSession } from '../../domain';
import { createDefaultEstimationConfig, createDefaultSolutionConfig, getScenario } from '../../seed';
import { saveAiSettings, defaultAiSettings } from '../../ai';
import type { ImportWorkspaceResult } from '../persistence';
import { importWorkspaceFile } from '../persistence';
import type { UseCaseDeps } from '../types';
import { makeNotice } from './notices';

/** Creates an empty session (default, un-configured solution/estimation config) and makes it active. */
export function createNewSession(deps: UseCaseDeps, name: string): ScopingSession {
  const session = createSession({
    id: newUid(),
    name,
    now: deps.now(),
    config: createDefaultSolutionConfig(),
    estimationConfig: createDefaultEstimationConfig(),
  });
  deps.dispatch({ type: 'UPSERT_SESSION', session });
  deps.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: session.id });
  return session;
}

/** Creates a session pre-filled from a seed scenario's customer, requirements text and suggested config. */
export function createSessionFromScenario(deps: UseCaseDeps, scenarioId: string): ScopingSession | null {
  const scenario = getScenario(scenarioId);
  if (scenario === undefined) {
    deps.dispatch({ type: 'ADD_NOTICE', notice: makeNotice('error', 'Scenario not found', `No seed scenario "${scenarioId}" is available.`) });
    return null;
  }
  const now = deps.now();
  const base = createSession({
    id: newUid(),
    name: scenario.name,
    now,
    config: { ...scenario.config },
    estimationConfig: createDefaultEstimationConfig(),
  });
  const session: ScopingSession = {
    ...base,
    customer: { ...scenario.customer },
    input: { ...base.input, rawText: scenario.requirementsText, scenarioId: scenario.id },
  };
  deps.dispatch({ type: 'UPSERT_SESSION', session });
  deps.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: session.id });
  return session;
}

export function renameSession(deps: UseCaseDeps, sessionId: string, name: string): void {
  const session = deps.getState().sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return;
  }
  deps.dispatch({ type: 'UPSERT_SESSION', session: { ...session, name, updatedAt: deps.now() } });
}

export function selectSession(deps: UseCaseDeps, sessionId: string | null): void {
  deps.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId });
}

export function deleteSession(deps: UseCaseDeps, sessionId: string): void {
  deps.dispatch({ type: 'REMOVE_SESSION', sessionId });
}

/** Wipes every session and resets AI settings to their defaults, in storage and in memory. */
export function deleteAllData(deps: UseCaseDeps): void {
  deps.dispatch({ type: 'CLEAR_SESSIONS' });
  const settings = defaultAiSettings();
  saveAiSettings(settings);
  deps.dispatch({ type: 'HYDRATE_AI_SETTINGS', settings });
}

function applyImportResult(deps: UseCaseDeps, result: ImportWorkspaceResult): ImportWorkspaceResult {
  if (result.ok) {
    deps.dispatch({ type: 'UPSERT_SESSION', session: result.session });
    deps.dispatch({ type: 'SET_ACTIVE_SESSION', sessionId: result.session.id });
    deps.dispatch({ type: 'ADD_NOTICE', notice: makeNotice('success', 'Session imported', `Imported "${result.session.name}".`) });
  } else {
    const detail = result.errors.at(0) ?? 'The file could not be imported.';
    deps.dispatch({ type: 'ADD_NOTICE', notice: makeNotice('error', 'Import failed', detail) });
  }
  return result;
}

/**
 * Reads and imports a workspace file, assigning it a fresh id, and surfaces the outcome as a
 * notice either way - including when the browser fails to read the file itself (e.g. it was
 * removed from disk between being picked and read), which `File.text()` reports as a rejection.
 */
export async function importSession(deps: UseCaseDeps, file: File): Promise<ImportWorkspaceResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return applyImportResult(deps, { ok: false, errors: ['The file could not be read.'] });
  }
  return applyImportResult(deps, importWorkspaceFile(text, deps.now()));
}
