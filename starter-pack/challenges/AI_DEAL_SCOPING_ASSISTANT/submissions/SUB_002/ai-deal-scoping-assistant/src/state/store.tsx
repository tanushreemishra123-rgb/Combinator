/**
 * React context + `useReducer` wiring for `AppState` (spec "Core User Journey": the whole workflow
 * lives in one reviewable session). `AppProvider` loads the persisted workspace and AI settings once
 * on mount and keeps sessions saved to storage as they change; `useActions()` is the only door the
 * UI mutates state through - every entry is a small, bound use case, never a raw `dispatch`.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Dispatch, ReactElement, ReactNode } from 'react';
import { loadAiSettings } from '../ai';
import type { ScopingSession } from '../domain';
import { loadSessions, saveSessions } from './persistence';
import { appReducer } from './reducer';
import type { AppAction, AppState, BoundUseCases, BusyState, UseCaseDeps } from './types';
import * as useCases from './useCases';
import { makeNotice } from './useCases/notices';

/**
 * Reads storage synchronously, in the `useReducer` lazy initializer rather than a mount effect. A
 * mount effect would dispatch the hydrated sessions asynchronously while a save effect - reading
 * the still-default empty list from the same commit - writes `[]` back to storage first; under
 * React StrictMode's double effect pass that second, now-corrupted read wins, deleting every saved
 * session. Reading here happens once, before the first render, so there is no window where a save
 * effect can observe pre-hydration state. Storage problems become notices in the initial state
 * instead of a dispatch, since there is no dispatch yet at this point.
 */
function initialAppState(): AppState {
  const { sessions, issues } = loadSessions();
  const notices = issues.map((issue) => makeNotice('warning', 'Workspace storage', issue));
  return { sessions, activeSessionId: null, aiSettings: loadAiSettings(), busy: null, notices };
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<AppAction> | null>(null);

function useStateContext(): AppState {
  const state = useContext(StateContext);
  if (state === null) {
    throw new Error('useAppState (or a hook that relies on it) was used outside an AppProvider.');
  }
  return state;
}

function useDispatchContext(): Dispatch<AppAction> {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) {
    throw new Error('useActions was used outside an AppProvider.');
  }
  return dispatch;
}

export interface AppProviderProps {
  children: ReactNode;
}

/** Hydrates the workspace synchronously before the first render; every later change to `sessions` is written straight back. */
export function AppProvider({ children }: AppProviderProps): ReactElement {
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState);

  useEffect(() => {
    const result = saveSessions(state.sessions);
    if (!result.ok && result.issue !== null) {
      dispatch({ type: 'ADD_NOTICE', notice: makeNotice('error', 'Workspace not saved', result.issue) });
    }
  }, [state.sessions]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/** The full application state (spec sections 1-6 workspaces all read from this one tree). */
export function useAppState(): AppState {
  return useStateContext();
}

/** The session named by `activeSessionId`, or `null` when none is selected yet. */
export function useActiveSession(): ScopingSession | null {
  const state = useStateContext();
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null;
}

/** The label/stage of the async use case currently running, or `null` when the app is idle. */
export function useBusy(): BusyState | null {
  return useStateContext().busy;
}

/** Reads the latest `AppState` from a ref updated after each commit, so `deps.getState()` in `useActions` never goes stale. */
function useLatestState(state: AppState): () => AppState {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  return useMemo(() => () => stateRef.current, [stateRef]);
}

/**
 * A stable, memoised object of every bound use case (spec "Recommended Application Sections":
 * every workspace's controls call through here, never `dispatch` directly). Each call still reads
 * the latest state through `getState`, so the returned functions never go stale even though the
 * object identity only changes when `dispatch` does (i.e. never, for the lifetime of the provider).
 */
export function useActions(): BoundUseCases {
  const state = useStateContext();
  const dispatch = useDispatchContext();
  const getState = useLatestState(state);

  const deps = useMemo<UseCaseDeps>(
    () => ({ getState, dispatch, now: () => new Date().toISOString() }),
    [getState, dispatch],
  );

  return useMemo<BoundUseCases>(
    () => ({
      createNewSession: (name) => useCases.createNewSession(deps, name),
      createSessionFromScenario: (scenarioId) => useCases.createSessionFromScenario(deps, scenarioId),
      renameSession: (sessionId, name) => useCases.renameSession(deps, sessionId, name),
      selectSession: (sessionId) => useCases.selectSession(deps, sessionId),
      deleteSession: (sessionId) => useCases.deleteSession(deps, sessionId),
      deleteAllData: () => useCases.deleteAllData(deps),
      importSession: (file) => useCases.importSession(deps, file),
      exportWorkspace: (sessionId) => useCases.exportWorkspace(deps, sessionId),

      setRequirementsText: (text) => useCases.setRequirementsText(deps, text),
      setCustomerContext: (patch) => useCases.setCustomerContext(deps, patch),
      addUploadedFile: (file) => useCases.addUploadedFile(deps, file),
      runAnalysis: () => useCases.runAnalysis(deps),

      editScopeItem: (itemId, patch) => useCases.editScopeItem(deps, itemId, patch),
      addScopeItem: (kind, fields) => useCases.addScopeItem(deps, kind, fields),
      removeScopeItem: (itemId) => useCases.removeScopeItem(deps, itemId),
      setItemReview: (itemId, review) => useCases.setItemReview(deps, itemId, review),
      approveAllPending: () => useCases.approveAllPending(deps),
      resolveScopeItem: (itemId, resolution) => useCases.resolveScopeItem(deps, itemId, resolution),
      reopenScopeItem: (itemId) => useCases.reopenScopeItem(deps, itemId),
      approveScope: () => useCases.approveScope(deps),

      updateSolutionConfig: (patch) => useCases.updateSolutionConfig(deps, patch),
      updateEstimationConfig: (patch) => useCases.updateEstimationConfig(deps, patch),
      setRoleRate: (roleId, dayRate) => useCases.setRoleRate(deps, roleId, dayRate),
      applyCommercialPreset: (presetId) => useCases.applyCommercialPreset(deps, presetId),
      setDriverComplexity: (driverId, complexity) => useCases.setDriverComplexity(deps, driverId, complexity),

      previewChange: (mutate) => useCases.previewChange(deps, mutate),
      applyChange: (mutate) => useCases.applyChange(deps, mutate),

      generateStage: (stageId) => useCases.generateStage(deps, stageId),
      generateAll: () => useCases.generateAll(deps),
      regenerateStale: (onlyStageId) => useCases.regenerateStale(deps, onlyStageId),
      setStageReviewed: (stageId, reviewed) => useCases.setStageReviewed(deps, stageId, reviewed),

      runQuality: () => useCases.runQuality(deps),
      refreshExecutiveSummary: () => useCases.refreshExecutiveSummary(deps),
      exportPackage: (format) => useCases.exportPackage(deps, format),

      updateAiSettings: (settings) => useCases.updateAiSettings(deps, settings),
      runConnectionTest: () => useCases.runConnectionTest(deps),
      dismissNotice: (noticeId) => useCases.dismissNotice(deps, noticeId),
      clearNotices: () => useCases.clearNotices(deps),
    }),
    [deps],
  );
}
