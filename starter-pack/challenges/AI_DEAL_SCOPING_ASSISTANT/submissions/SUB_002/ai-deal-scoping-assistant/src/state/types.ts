/**
 * Application-state shape and action union for the state layer (React context + `useReducer`, see
 * `store.tsx`/`reducer.ts`). `AppState` is the one piece of state the whole UI reads from; every
 * async use case (a later addition to this module) is a plain function that reads it through
 * `getState()` and changes it only by dispatching one of these actions, so every transition stays
 * inspectable and unit-testable without React.
 */
import type { AiSettings } from '../ai';
import type {
  ChangeDescriptor,
  Complexity,
  CustomerContext,
  EstimationConfig,
  ExportFormat,
  ExportStatus,
  ImpactReport,
  ReviewStatus,
  RoleId,
  ScopeItemKind,
  ScopingSession,
  SessionOutputs,
  SolutionConfig,
} from '../domain';
import type { NewScopeItemFields, ScopeItemPatch } from '../scope';
import type { ImportWorkspaceResult } from './persistence';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

/** A dismissible message surfaced to the reviewer (success/failure of an action, a storage warning, ...). */
export interface Notice {
  id: string;
  tone: NoticeTone;
  title: string;
  message: string;
}

/** Set while an async use case (analysis, generation, export, ...) is running; `stageId` names which one. */
export interface BusyState {
  label: string;
  stageId: string | null;
}

export interface AppState {
  sessions: ScopingSession[];
  activeSessionId: string | null;
  aiSettings: AiSettings;
  busy: BusyState | null;
  notices: Notice[];
}

/**
 * What every async use case receives instead of importing the store directly - the same shape a
 * unit test constructs by hand, so use cases are testable without React (`getState` always reads
 * the latest state, `now` is the injectable clock every pure calculation downstream needs).
 */
export interface UseCaseDeps {
  getState(): AppState;
  dispatch(action: AppAction): void;
  now(): string;
}

export type AppAction =
  | { type: 'HYDRATE_SESSIONS'; sessions: ScopingSession[] }
  | { type: 'UPSERT_SESSION'; session: ScopingSession }
  | { type: 'REMOVE_SESSION'; sessionId: string }
  | { type: 'CLEAR_SESSIONS' }
  | { type: 'SET_ACTIVE_SESSION'; sessionId: string | null }
  | { type: 'HYDRATE_AI_SETTINGS'; settings: AiSettings }
  | { type: 'UPDATE_AI_SETTINGS'; settings: AiSettings }
  | { type: 'START_BUSY'; label: string; stageId: string | null }
  | { type: 'END_BUSY' }
  | { type: 'ADD_NOTICE'; notice: Notice }
  | { type: 'DISMISS_NOTICE'; noticeId: string }
  | { type: 'CLEAR_NOTICES' };

/** One of the five generation stages (keys of `SessionOutputs`). */
export type StageId = keyof SessionOutputs;

/** A hypothetical or real edit to the active session, expressed as a pure function. */
export type SessionMutation = (session: ScopingSession) => ScopingSession;

/** Result of analysing a change: what changed and one rule-based impact report per change. */
export interface ChangePreview {
  changes: ChangeDescriptor[];
  reports: ImpactReport[];
}

/**
 * The public shape of `useActions()` (see `store.tsx`). Every entry acts on the ACTIVE session.
 * Edits to the reviewed scope or configuration are asynchronous because, once any deliverable has
 * been generated, they run through the change flow (describeChanges -> createImpactReport ->
 * applyImpactReport) instead of silently replacing content. Failures never throw to the caller:
 * they are converted into error notices.
 */
export interface BoundUseCases {
  // Sessions
  createNewSession(name: string): ScopingSession;
  createSessionFromScenario(scenarioId: string): ScopingSession | null;
  renameSession(sessionId: string, name: string): void;
  selectSession(sessionId: string | null): void;
  deleteSession(sessionId: string): void;
  deleteAllData(): void;
  /** Reads and imports the file; resolves once the outcome (success or failure, including an unreadable file) has been surfaced as a notice. */
  importSession(file: File): Promise<ImportWorkspaceResult>;
  /** Downloads the active session as a schema-validated workspace JSON file (never contains keys). */
  /** Exports `sessionId` when given, otherwise the active session. */
  exportWorkspace(sessionId?: string): void;

  // Customer requirements input
  setRequirementsText(text: string): void;
  setCustomerContext(patch: Partial<CustomerContext>): void;
  addUploadedFile(file: File): Promise<void>;

  // Requirement analysis (resets every downstream deliverable - a new analysis invalidates them)
  runAnalysis(): Promise<void>;

  // Scope review
  editScopeItem(itemId: string, patch: ScopeItemPatch): Promise<void>;
  addScopeItem(kind: ScopeItemKind, fields: NewScopeItemFields): Promise<void>;
  removeScopeItem(itemId: string): Promise<void>;
  setItemReview(itemId: string, review: ReviewStatus): Promise<void>;
  approveAllPending(): Promise<void>;
  resolveScopeItem(itemId: string, resolution: string): Promise<void>;
  reopenScopeItem(itemId: string): Promise<void>;
  approveScope(): void;

  // Solution and commercial configuration
  updateSolutionConfig(patch: Partial<SolutionConfig>): Promise<void>;
  updateEstimationConfig(patch: Partial<EstimationConfig>): Promise<void>;
  setRoleRate(roleId: RoleId, dayRate: number | null): Promise<void>;
  applyCommercialPreset(presetId: string): Promise<void>;
  setDriverComplexity(driverId: string, complexity: Complexity): Promise<void>;

  // Change impact
  /** Analyses a hypothetical edit without saving anything. */
  previewChange(mutate: SessionMutation): Promise<ChangePreview>;
  /** Saves the edit, logs one impact report per change and marks only the affected stages stale. */
  applyChange(mutate: SessionMutation): Promise<ChangePreview>;

  // Generation
  generateStage(stageId: StageId): Promise<void>;
  generateAll(): Promise<void>;
  /** Regenerates / recalculates stale stages, in dependency order; current stages are untouched. With `onlyStageId`, only that one stage is touched. */
  regenerateStale(onlyStageId?: StageId): Promise<void>;
  setStageReviewed(stageId: StageId, reviewed: boolean): void;

  // Quality gate and export
  runQuality(): void;
  refreshExecutiveSummary(): Promise<void>;
  /** Runs the quality gate if needed, downloads the package and returns the stamped export status. */
  exportPackage(format: ExportFormat): Promise<ExportStatus | null>;

  // AI settings and notices
  updateAiSettings(settings: AiSettings): void;
  runConnectionTest(): Promise<{ ok: boolean; message: string }>;
  dismissNotice(noticeId: string): void;
  clearNotices(): void;
}
