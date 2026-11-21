/**
 * Pure state transitions for `AppState` (see `types.ts`). Every case returns a brand-new object;
 * a session or notice not targeted by the action is returned by reference, unchanged, so React
 * never re-renders content that did not actually change.
 */
import type { AiSettings } from '../ai';
import type { ScopingSession } from '../domain';
import type { AppAction, AppState, BusyState, Notice } from './types';

function upsertSession(sessions: readonly ScopingSession[], session: ScopingSession): ScopingSession[] {
  const exists = sessions.some((candidate) => candidate.id === session.id);
  return exists ? sessions.map((candidate) => (candidate.id === session.id ? session : candidate)) : [...sessions, session];
}

function removeSession(state: AppState, sessionId: string): AppState {
  const sessions = state.sessions.filter((session) => session.id !== sessionId);
  const activeSessionId = state.activeSessionId === sessionId ? null : state.activeSessionId;
  return { ...state, sessions, activeSessionId };
}

function startBusy(label: string, stageId: string | null): BusyState {
  return { label, stageId };
}

function addNotice(notices: readonly Notice[], notice: Notice): Notice[] {
  return [...notices, notice];
}

function dismissNotice(notices: readonly Notice[], noticeId: string): Notice[] {
  return notices.filter((notice) => notice.id !== noticeId);
}

function setAiSettings(state: AppState, settings: AiSettings): AppState {
  return { ...state, aiSettings: settings };
}

/** Exhaustiveness guard: a TypeScript error here means `AppAction` grew a case this switch does not handle. */
function assertNever(action: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(action)}`);
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE_SESSIONS':
      return { ...state, sessions: action.sessions };
    case 'UPSERT_SESSION':
      return { ...state, sessions: upsertSession(state.sessions, action.session) };
    case 'REMOVE_SESSION':
      return removeSession(state, action.sessionId);
    case 'CLEAR_SESSIONS':
      return { ...state, sessions: [], activeSessionId: null };
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.sessionId };
    case 'HYDRATE_AI_SETTINGS':
      return setAiSettings(state, action.settings);
    case 'UPDATE_AI_SETTINGS':
      return setAiSettings(state, action.settings);
    case 'START_BUSY':
      return { ...state, busy: startBusy(action.label, action.stageId) };
    case 'END_BUSY':
      return { ...state, busy: null };
    case 'ADD_NOTICE':
      return { ...state, notices: addNotice(state.notices, action.notice) };
    case 'DISMISS_NOTICE':
      return { ...state, notices: dismissNotice(state.notices, action.noticeId) };
    case 'CLEAR_NOTICES':
      return { ...state, notices: [] };
    default:
      return assertNever(action);
  }
}
