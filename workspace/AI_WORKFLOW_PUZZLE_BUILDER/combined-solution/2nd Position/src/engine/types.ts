/**
 * Core workflow model shared by the builder UI, the execution engine,
 * puzzle definitions, and the reliability report.
 *
 * A workflow is a linear sequence of steps. A Condition step may contain
 * two nested linear branches ("then" / "else"), which is sufficient for
 * every puzzle in this lab (confirmed in the challenge forum: a linear
 * workflow with conditional branching is enough).
 */

export type StepKind =
  | 'input'
  | 'ai'
  | 'tool'
  | 'retrieval'
  | 'condition'
  | 'transform'
  | 'validator'
  | 'human'
  | 'safestop'
  | 'output';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'recovered'
  | 'failed'
  | 'paused'
  | 'safe-stopped'
  | 'skipped'
  | 'restored';

/** Retry upgrade: number of extra attempts after the first one (1–3). */
export interface RetryUpgrade {
  attempts: number;
}

/** Fallback upgrade: what to do once every attempt has failed. */
export type FallbackUpgrade =
  | { type: 'provider'; providerId: string }
  | { type: 'tool'; toolId: string }
  | { type: 'default'; defaultId: string };

export interface StepUpgrades {
  retry?: RetryUpgrade;
  fallback?: FallbackUpgrade;
}

interface BaseStep {
  id: string;
  label: string;
  /** Locked steps (Input / Output) cannot be moved or removed. */
  locked?: boolean;
}

export interface InputStep extends BaseStep {
  kind: 'input';
}

export interface AiStep extends BaseStep {
  kind: 'ai';
  taskId: string;
  providerId: string;
  upgrades: StepUpgrades;
  /** What happens when all attempts and fallbacks are exhausted. */
  onExhausted: 'safe-stop' | 'fail';
}

export interface ToolStep extends BaseStep {
  kind: 'tool';
  toolId: string;
  upgrades: StepUpgrades;
  onExhausted: 'safe-stop' | 'fail';
}

/**
 * Retrieval never hard-crashes: an empty result is a *soft* failure that
 * downstream Condition / Validator blocks are expected to handle.
 */
export interface RetrievalStep extends BaseStep {
  kind: 'retrieval';
  sourceId: string;
  topK: number;
}

export interface ConditionStep extends BaseStep {
  kind: 'condition';
  conditionId: string;
  branches: { then: WorkflowStep[]; else: WorkflowStep[] };
}

export interface TransformStep extends BaseStep {
  kind: 'transform';
  transformId: string;
}

/**
 * Validator checks the output of the previous step against a schema preset.
 * On failure it walks an escalation ladder in this fixed, readable order:
 * retry the previous step → repair the output → use a safe default →
 * escalate to a human → final action (safe stop or hard fail).
 */
export interface ValidatorStep extends BaseStep {
  kind: 'validator';
  schemaId: string;
  retryPrevious: number; // 0–2 re-runs of the previous step
  repair: boolean;
  useDefault: boolean;
  defaultId?: string;
  escalate: boolean;
  finalAction: 'safe-stop' | 'fail';
}

export interface HumanStep extends BaseStep {
  kind: 'human';
  title: string;
  instructions: string;
  allowEdit: boolean;
  /** Optional schema the (edited) payload must satisfy before continuing. */
  schemaId?: string;
}

export interface SafeStopStep extends BaseStep {
  kind: 'safestop';
  message: string;
}

export interface OutputStep extends BaseStep {
  kind: 'output';
}

export type WorkflowStep =
  | InputStep
  | AiStep
  | ToolStep
  | RetrievalStep
  | ConditionStep
  | TransformStep
  | ValidatorStep
  | HumanStep
  | SafeStopStep
  | OutputStep;

export type ResilientStep = AiStep | ToolStep;

export function isResilient(step: WorkflowStep): step is ResilientStep {
  return step.kind === 'ai' || step.kind === 'tool';
}

/** Execution context threaded through the run. */
export interface RunContext {
  /** The committed sample input the run started with. */
  input: unknown;
  /** Output of every completed step, keyed by step id. */
  outputs: Record<string, unknown>;
  /** Output of the most recently completed data-producing step. */
  last: unknown;
  /** Kind of every completed step, keyed by step id (used by transforms). */
  kinds: Record<string, StepKind>;
}

/** A single retrieved document. */
export interface RetrievedDoc {
  id: string;
  title: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

export type FailureKind =
  | 'timeout'
  | 'provider-error'
  | 'tool-error'
  | 'invalid-json'
  | 'missing-field'
  | 'schema'
  | 'empty-retrieval'
  | 'low-confidence'
  | 'rejected'
  | 'interrupted'
  | 'aborted';

export interface FailureInfo {
  kind: FailureKind;
  message: string;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Human-in-the-loop
// ---------------------------------------------------------------------------

export interface HumanPrompt {
  /** 'approval' = deliberate review gate; 'fix' = validator escalation. */
  mode: 'approval' | 'fix';
  stepId: string;
  stepLabel: string;
  title: string;
  instructions: string;
  allowEdit: boolean;
  schemaId?: string;
  /** The payload awaiting review (draft, classification, extraction, …). */
  payload: unknown;
  /** Validation issues that triggered a 'fix' escalation. */
  issues?: string[];
}

export interface HumanDecision {
  action: 'approve' | 'edit' | 'reject';
  /** Present when action = 'edit'. */
  payload?: unknown;
  note?: string;
}

// ---------------------------------------------------------------------------
// Trace events — the reviewer-visible record of everything that happened.
// ---------------------------------------------------------------------------

export type TraceEvent =
  | { t: 'run-started'; at: number; sampleLabel: string; scenarios: string[]; mode: 'mock' | 'live'; resumed: boolean }
  | { t: 'step-started'; at: number; stepId: string; label: string; kind: StepKind; input: unknown }
  | { t: 'step-restored'; at: number; stepId: string; label: string; output: unknown }
  | { t: 'attempt-started'; at: number; stepId: string; attempt: number; via: string }
  | { t: 'attempt-failed'; at: number; stepId: string; attempt: number; failure: FailureInfo }
  | { t: 'retry-scheduled'; at: number; stepId: string; nextAttempt: number }
  | { t: 'fallback-activated'; at: number; stepId: string; description: string }
  | { t: 'step-completed'; at: number; stepId: string; output: unknown; durationMs: number; recovered: boolean; degraded?: boolean }
  | { t: 'validation-result'; at: number; stepId: string; targetStepId: string; ok: boolean; issues: string[] }
  | { t: 'repair-applied'; at: number; stepId: string; notes: string[]; before: unknown; after: unknown; resolved: boolean }
  | { t: 'default-used'; at: number; stepId: string; value: unknown; label: string }
  | { t: 'branch-taken'; at: number; stepId: string; branch: 'then' | 'else'; reason: string }
  | { t: 'paused-for-human'; at: number; stepId: string; prompt: HumanPrompt }
  | { t: 'human-decision'; at: number; stepId: string; decision: HumanDecision }
  | { t: 'safe-stopped'; at: number; stepId: string; reason: string }
  | { t: 'checkpoint-saved'; at: number; afterStepId: string; completedSteps: number }
  | { t: 'run-interrupted'; at: number; stepId: string; message: string }
  | { t: 'run-failed'; at: number; stepId: string; failure: FailureInfo }
  | { t: 'run-finished'; at: number; status: RunStatus; output?: unknown; outputValid?: boolean; outputIssues?: string[] };

export type RunStatus = 'completed' | 'failed' | 'safe-stopped' | 'interrupted' | 'aborted';

// ---------------------------------------------------------------------------
// Checkpoint (used by the "Resume the Interrupted Mission" puzzle)
// ---------------------------------------------------------------------------

export interface Checkpoint {
  /** Hash of the workflow structure the checkpoint was taken from. */
  workflowHash: string;
  sampleId: string;
  scenarios: string[];
  completedStepIds: string[];
  outputs: Record<string, unknown>;
  kinds: Record<string, StepKind>;
  last: unknown;
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Run report — the aggregate the reliability feedback is computed from.
// ---------------------------------------------------------------------------

export interface HumanDecisionRecord {
  stepId: string;
  stepLabel: string;
  mode: 'approval' | 'fix';
  decision: HumanDecision;
  at: number;
}

export interface RunReport {
  runId: string;
  puzzleId: string;
  status: RunStatus;
  startedAt: number;
  finishedAt: number;
  sampleId: string;
  scenarios: string[];
  mode: 'mock' | 'live';
  resumed: boolean;
  stepsExecuted: number;
  stepsRestored: number;
  retriesUsed: number;
  fallbacksActivated: string[];
  validationsPassed: number;
  validationsFailed: number;
  repairsApplied: number;
  defaultsUsed: number;
  humanDecisions: HumanDecisionRecord[];
  safeStopReason?: string;
  unhandledFailure?: { stepId: string; stepLabel: string; failure: FailureInfo };
  failureKindsSeen: FailureKind[];
  finalOutput?: unknown;
  finalOutputValid?: boolean;
  finalOutputIssues?: string[];
  /** Saved when a simulated interruption cut the run short. */
  checkpoint?: Checkpoint;
  events: TraceEvent[];
  /** Per-step status at the end of the run, keyed by step id. */
  stepStatuses: Record<string, StepStatus>;
}
