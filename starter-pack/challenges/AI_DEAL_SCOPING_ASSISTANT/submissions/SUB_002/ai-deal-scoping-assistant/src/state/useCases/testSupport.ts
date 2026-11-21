/**
 * Test double for `UseCaseDeps`: a real reducer behind a hand-rolled store, so use cases are tested
 * without React. With `lagging: true`, `getState()` keeps returning the state from before the use
 * case started - exactly how the React store behaves inside one async use case (its state ref only
 * refreshes after a re-render) - which proves a use case threads the session locally.
 */
import { defaultAiSettings } from '../../ai';
import type { ScopingSession } from '../../domain';
import { appReducer } from '../reducer';
import type { AppAction, AppState, Notice, UseCaseDeps } from '../types';

export const TEST_NOW = '2026-09-19T08:00:00.000Z';

export interface FakeStore {
  deps: UseCaseDeps;
  actions: AppAction[];
  /** The committed state: every dispatched action reduced, regardless of `lagging`. */
  state(): AppState;
  activeSession(): ScopingSession | null;
  notices(): Notice[];
}

export interface FakeStoreOptions {
  lagging?: boolean;
}

export function createFakeStore(session: ScopingSession | null, options: FakeStoreOptions = {}): FakeStore {
  const initial: AppState = {
    sessions: session === null ? [] : [session],
    activeSessionId: session?.id ?? null,
    aiSettings: defaultAiSettings(),
    busy: null,
    notices: [],
  };
  let committed = initial;
  const actions: AppAction[] = [];
  const deps: UseCaseDeps = {
    getState: () => (options.lagging === true ? initial : committed),
    dispatch: (action) => {
      actions.push(action);
      committed = appReducer(committed, action);
    },
    now: () => TEST_NOW,
  };
  return {
    deps,
    actions,
    state: () => committed,
    activeSession: () => committed.sessions.find((candidate) => candidate.id === committed.activeSessionId) ?? null,
    notices: () => committed.notices,
  };
}
