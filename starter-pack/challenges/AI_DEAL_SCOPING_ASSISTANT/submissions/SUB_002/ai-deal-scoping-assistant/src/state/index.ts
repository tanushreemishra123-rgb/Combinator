/**
 * Public API of the application state layer - the only module the UI imports to read or change
 * data. Hooks expose the state, `useActions()` exposes every use case, selectors derive views.
 */
export { AppProvider, useActions, useActiveSession, useAppState, useBusy } from './store';
export type { AppProviderProps } from './store';
export * from './selectors';
export type {
  AppState,
  BoundUseCases,
  BusyState,
  ChangePreview,
  Notice,
  NoticeTone,
  SessionMutation,
  StageId,
} from './types';
export type { ImportWorkspaceResult } from './persistence';
