import type {
  AiStep,
  ConditionStep,
  FailureInfo,
  FailureKind,
  HumanStep,
  InputStep,
  OutputStep,
  RetrievalStep,
  SafeStopStep,
  StepUpgrades,
  ToolStep,
  TransformStep,
  ValidatorStep,
  WorkflowStep,
} from '../engine/types';
import type { ModelOutcome } from './types';

// ---------------------------------------------------------------------------
// Mock outcome helpers
// ---------------------------------------------------------------------------

export const ok = (value: unknown, note?: string): ModelOutcome => ({ type: 'ok', value, note });

export const failWith = (kind: FailureKind, message: string, retryable: boolean): ModelOutcome => ({
  type: 'error',
  failure: { kind, message, retryable } satisfies FailureInfo,
});

export const timeout = (what: string, ms: number): ModelOutcome =>
  failWith('timeout', `${what} timed out after ${ms} ms (simulated)`, true);

export const interrupt = (message: string): ModelOutcome => ({ type: 'interrupt', message });

// ---------------------------------------------------------------------------
// Step factories — used by puzzle definitions, palettes, and tests
// ---------------------------------------------------------------------------

export const mkInput = (id = 'step-input'): InputStep => ({
  id,
  kind: 'input',
  label: 'Sample Input',
  locked: true,
});

export const mkOutput = (id = 'step-output'): OutputStep => ({
  id,
  kind: 'output',
  label: 'Final Output',
  locked: true,
});

export const mkAi = (
  id: string,
  label: string,
  taskId: string,
  providerId: string,
  extra?: { upgrades?: StepUpgrades; onExhausted?: 'safe-stop' | 'fail' },
): AiStep => ({
  id,
  kind: 'ai',
  label,
  taskId,
  providerId,
  upgrades: extra?.upgrades ?? {},
  onExhausted: extra?.onExhausted ?? 'fail',
});

export const mkTool = (
  id: string,
  label: string,
  toolId: string,
  extra?: { upgrades?: StepUpgrades; onExhausted?: 'safe-stop' | 'fail' },
): ToolStep => ({
  id,
  kind: 'tool',
  label,
  toolId,
  upgrades: extra?.upgrades ?? {},
  onExhausted: extra?.onExhausted ?? 'fail',
});

export const mkRetrieval = (id: string, label: string, sourceId: string, topK = 3): RetrievalStep => ({
  id,
  kind: 'retrieval',
  label,
  sourceId,
  topK,
});

export const mkTransform = (id: string, label: string, transformId: string): TransformStep => ({
  id,
  kind: 'transform',
  label,
  transformId,
});

export const mkValidator = (
  id: string,
  label: string,
  schemaId: string,
  opts?: Partial<Pick<ValidatorStep, 'retryPrevious' | 'repair' | 'useDefault' | 'defaultId' | 'escalate' | 'finalAction'>>,
): ValidatorStep => ({
  id,
  kind: 'validator',
  label,
  schemaId,
  retryPrevious: opts?.retryPrevious ?? 0,
  repair: opts?.repair ?? false,
  useDefault: opts?.useDefault ?? false,
  defaultId: opts?.defaultId,
  escalate: opts?.escalate ?? false,
  finalAction: opts?.finalAction ?? 'safe-stop',
});

export const mkHuman = (
  id: string,
  label: string,
  opts: { title: string; instructions: string; allowEdit?: boolean; schemaId?: string },
): HumanStep => ({
  id,
  kind: 'human',
  label,
  title: opts.title,
  instructions: opts.instructions,
  allowEdit: opts.allowEdit ?? true,
  schemaId: opts.schemaId,
});

export const mkCondition = (
  id: string,
  label: string,
  conditionId: string,
  branches?: { then?: WorkflowStep[]; else?: WorkflowStep[] },
): ConditionStep => ({
  id,
  kind: 'condition',
  label,
  conditionId,
  branches: { then: branches?.then ?? [], else: branches?.else ?? [] },
});

export const mkSafeStop = (id: string, label: string, message: string): SafeStopStep => ({
  id,
  kind: 'safestop',
  label,
  message,
});
