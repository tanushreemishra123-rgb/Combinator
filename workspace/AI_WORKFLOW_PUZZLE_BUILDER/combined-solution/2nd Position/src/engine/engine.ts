import type { ModelOutcome, PuzzleKit } from '../puzzles/types';
import type {
  AiStep,
  Checkpoint,
  ConditionStep,
  FailureInfo,
  FailureKind,
  HumanDecision,
  HumanPrompt,
  HumanStep,
  ResilientStep,
  RunContext,
  RunReport,
  RunStatus,
  StepStatus,
  ToolStep,
  TraceEvent,
  ValidatorStep,
  WorkflowStep,
} from './types';
import { isResilient } from './types';
import { validateAgainst } from './validation';
import { clone, flattenSteps, hashWorkflow, uid } from './util';

export interface EngineOptions {
  kit: PuzzleKit;
  workflow: WorkflowStep[];
  sampleId: string;
  scenarios: string[];
  mode: 'mock' | 'live';
  pace: 'demo' | 'instant';
  human: (prompt: HumanPrompt) => Promise<HumanDecision>;
  onEvent?: (event: TraceEvent) => void;
  checkpoint?: Checkpoint | null;
  /** Live AI call — only used for AI steps when mode = 'live'. */
  liveCall?: (prompt: string, expectsJson: boolean) => Promise<string>;
  signal?: AbortSignal;
}

type EndState =
  | { status: 'safe-stopped'; stepId: string; reason: string }
  | { status: 'failed'; stepId: string; failure: FailureInfo }
  | { status: 'interrupted'; stepId: string; message: string }
  | { status: 'aborted' };

class EndRun extends Error {
  constructor(public readonly end: EndState) {
    super(`run ended: ${end.status}`);
  }
}

const DEMO_WAITS = { step: 220, attempt: 420 };

export async function runWorkflow(options: EngineOptions): Promise<RunReport> {
  const engine = new Engine(options);
  return engine.run();
}

class Engine {
  private readonly o: EngineOptions;
  private readonly scenarios: ReadonlySet<string>;
  private readonly events: TraceEvent[] = [];
  private readonly statuses: Record<string, StepStatus> = {};
  private readonly attempts = new Map<string, number>();
  /** The input each step originally ran with — used when a validator re-runs a step. */
  private readonly stepInputs: Record<string, unknown> = {};
  private readonly restoredIds: Set<string>;
  private readonly completedTopIds: string[] = [];
  private ctx: RunContext;
  private startedAt = 0;

  // counters for the report
  private stepsExecuted = 0;
  private stepsRestored = 0;
  private retriesUsed = 0;
  private fallbacksActivated: string[] = [];
  private validationsPassed = 0;
  private validationsFailed = 0;
  private repairsApplied = 0;
  private defaultsUsed = 0;
  private humanDecisions: RunReport['humanDecisions'] = [];
  private failureKinds = new Set<FailureKind>();
  private safeStopReason?: string;
  private unhandledFailure?: RunReport['unhandledFailure'];
  private checkpointOut?: Checkpoint;
  private finalOutput?: unknown;
  private finalOutputValid?: boolean;
  private finalOutputIssues?: string[];

  constructor(options: EngineOptions) {
    this.o = options;
    this.scenarios = new Set(options.scenarios);
    const sample = options.kit.sample(options.sampleId);
    const cp = options.checkpoint ?? null;
    this.restoredIds = new Set(cp?.completedStepIds ?? []);
    this.ctx = cp
      ? { input: clone(sample.value), outputs: clone(cp.outputs), last: clone(cp.last), kinds: { ...cp.kinds } }
      : { input: clone(sample.value), outputs: {}, last: clone(sample.value), kinds: {} };
    for (const step of flattenSteps(options.workflow)) {
      this.statuses[step.id] = 'pending';
    }
  }

  async run(): Promise<RunReport> {
    this.startedAt = Date.now();
    const sample = this.o.kit.sample(this.o.sampleId);
    this.emit({
      t: 'run-started',
      at: Date.now(),
      sampleLabel: sample.label,
      scenarios: [...this.scenarios],
      mode: this.o.mode,
      resumed: this.restoredIds.size > 0,
    });

    let status: RunStatus = 'completed';
    try {
      await this.runSequence(this.o.workflow, true);
      this.emit({
        t: 'run-finished',
        at: Date.now(),
        status: 'completed',
        output: this.finalOutput,
        outputValid: this.finalOutputValid,
        outputIssues: this.finalOutputIssues,
      });
    } catch (err) {
      if (!(err instanceof EndRun)) throw err;
      const end = err.end;
      status = end.status;
      if (end.status === 'failed') {
        const label = this.labelOf(end.stepId);
        this.unhandledFailure = { stepId: end.stepId, stepLabel: label, failure: end.failure };
        this.emit({ t: 'run-failed', at: Date.now(), stepId: end.stepId, failure: end.failure });
      }
      this.emit({ t: 'run-finished', at: Date.now(), status });
    }

    return {
      runId: uid(),
      puzzleId: this.o.kit.puzzle.id,
      status,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      sampleId: this.o.sampleId,
      scenarios: [...this.scenarios],
      mode: this.o.mode,
      resumed: this.restoredIds.size > 0,
      stepsExecuted: this.stepsExecuted,
      stepsRestored: this.stepsRestored,
      retriesUsed: this.retriesUsed,
      fallbacksActivated: this.fallbacksActivated,
      validationsPassed: this.validationsPassed,
      validationsFailed: this.validationsFailed,
      repairsApplied: this.repairsApplied,
      defaultsUsed: this.defaultsUsed,
      humanDecisions: this.humanDecisions,
      safeStopReason: this.safeStopReason,
      unhandledFailure: this.unhandledFailure,
      failureKindsSeen: [...this.failureKinds],
      finalOutput: this.finalOutput,
      finalOutputValid: this.finalOutputValid,
      finalOutputIssues: this.finalOutputIssues,
      checkpoint: this.checkpointOut,
      events: this.events,
      stepStatuses: { ...this.statuses },
    };
  }

  // -------------------------------------------------------------------------

  private emit(event: TraceEvent) {
    this.events.push(event);
    this.o.onEvent?.(event);
  }

  private setStatus(stepId: string, status: StepStatus) {
    this.statuses[stepId] = status;
  }

  private labelOf(stepId: string): string {
    return flattenSteps(this.o.workflow).find((s) => s.id === stepId)?.label ?? stepId;
  }

  private async wait(ms: number) {
    if (ms <= 0) {
      this.checkAborted();
      return;
    }
    const until = Date.now() + ms;
    while (Date.now() < until) {
      this.checkAborted();
      await new Promise((resolve) => setTimeout(resolve, Math.min(60, until - Date.now())));
    }
    this.checkAborted();
  }

  private checkAborted() {
    if (this.o.signal?.aborted) throw new EndRun({ status: 'aborted' });
  }

  private paceStep() {
    return this.o.pace === 'demo' ? DEMO_WAITS.step : 0;
  }

  private paceAttempt() {
    return this.o.pace === 'demo' ? DEMO_WAITS.attempt : 0;
  }

  // -------------------------------------------------------------------------
  // Sequence walking
  // -------------------------------------------------------------------------

  private async runSequence(steps: WorkflowStep[], topLevel: boolean): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (topLevel && this.restoredIds.has(step.id)) {
        this.setStatus(step.id, 'restored');
        this.stepsRestored++;
        this.emit({
          t: 'step-restored',
          at: Date.now(),
          stepId: step.id,
          label: step.label,
          output: clone(this.ctx.outputs[step.id]),
        });
        continue;
      }

      const prev = i > 0 ? steps[i - 1] : undefined;
      await this.execStep(step, prev, topLevel);
    }
  }

  private async execStep(step: WorkflowStep, prev: WorkflowStep | undefined, topLevel: boolean): Promise<void> {
    this.checkAborted();
    const stepInput = clone(step.kind === 'input' ? this.ctx.input : this.ctx.last);
    this.stepInputs[step.id] = stepInput;
    this.emit({
      t: 'step-started',
      at: Date.now(),
      stepId: step.id,
      label: step.label,
      kind: step.kind,
      input: clone(stepInput),
    });
    this.setStatus(step.id, 'running');
    this.stepsExecuted++;
    const startedAt = Date.now();
    await this.wait(this.paceStep());

    switch (step.kind) {
      case 'input': {
        this.completeData(step.id, clone(this.ctx.input), startedAt, false);
        break;
      }
      case 'ai':
      case 'tool': {
        const { value, recovered, degraded } = await this.runResilient(step);
        this.completeData(step.id, value, startedAt, recovered, degraded);
        break;
      }
      case 'retrieval': {
        const source = this.o.kit.source(step.sourceId);
        const docs = source.search(this.ctx.last, step.topK, this.scenarios);
        if (docs.length === 0) this.failureKinds.add('empty-retrieval');
        this.completeData(step.id, { query: this.describeQuery(), docs }, startedAt, false);
        break;
      }
      case 'transform': {
        const preset = this.o.kit.transform(step.transformId);
        let value: unknown;
        try {
          value = preset.apply(this.ctx);
        } catch (err) {
          const failure: FailureInfo = {
            kind: 'tool-error',
            message: `Transform failed: ${err instanceof Error ? err.message : String(err)}`,
            retryable: false,
          };
          this.setStatus(step.id, 'failed');
          throw new EndRun({ status: 'failed', stepId: step.id, failure });
        }
        this.completeData(step.id, value, startedAt, false);
        break;
      }
      case 'condition': {
        await this.runCondition(step);
        break;
      }
      case 'validator': {
        await this.runValidator(step, prev, startedAt);
        break;
      }
      case 'human': {
        await this.runHuman(step, startedAt);
        break;
      }
      case 'safestop': {
        this.safeStop(step.id, step.message);
        break;
      }
      case 'output': {
        this.finalOutput = clone(this.ctx.last);
        const schemaId = this.o.kit.puzzle.expected.schemaId;
        if (schemaId) {
          const outcome = validateAgainst(this.o.kit.schema(schemaId).schema, this.ctx.last);
          this.finalOutputValid = outcome.ok;
          this.finalOutputIssues = outcome.issues;
          for (const kind of outcome.failureKinds) this.failureKinds.add(kind);
        } else {
          this.finalOutputValid = true;
          this.finalOutputIssues = [];
        }
        this.completeData(step.id, clone(this.ctx.last), startedAt, false);
        break;
      }
    }

    if (topLevel && this.statuses[step.id] !== 'failed') {
      this.completedTopIds.push(step.id);
    }
  }

  private completeData(stepId: string, output: unknown, startedAt: number, recovered: boolean, degraded?: boolean) {
    this.ctx.outputs[stepId] = clone(output);
    const step = flattenSteps(this.o.workflow).find((s) => s.id === stepId);
    if (step) this.ctx.kinds[stepId] = step.kind;
    if (step && step.kind !== 'validator') {
      this.ctx.last = clone(output);
    }
    this.setStatus(stepId, recovered ? 'recovered' : 'completed');
    this.emit({
      t: 'step-completed',
      at: Date.now(),
      stepId,
      output: clone(output),
      durationMs: Date.now() - startedAt,
      recovered,
      degraded,
    });
  }

  private safeStop(stepId: string, reason: string): never {
    this.safeStopReason = reason;
    this.setStatus(stepId, 'safe-stopped');
    this.emit({ t: 'safe-stopped', at: Date.now(), stepId, reason });
    throw new EndRun({ status: 'safe-stopped', stepId, reason });
  }

  private describeQuery(): string {
    const last = this.ctx.last;
    if (typeof last === 'string') return last;
    if (last && typeof last === 'object' && 'question' in (last as Record<string, unknown>)) {
      return String((last as Record<string, unknown>).question);
    }
    return JSON.stringify(last)?.slice(0, 120) ?? '';
  }

  // -------------------------------------------------------------------------
  // Resilient execution: attempts → retries → fallback → exhausted policy
  // -------------------------------------------------------------------------

  private async runResilient(step: ResilientStep): Promise<{ value: unknown; recovered: boolean; degraded?: boolean }> {
    const maxAttempts = 1 + (step.upgrades.retry?.attempts ?? 0);
    let lastFailure: FailureInfo | undefined;
    let attemptsUsedHere = 0;

    for (let local = 1; local <= maxAttempts; local++) {
      attemptsUsedHere++;
      const attempt = (this.attempts.get(step.id) ?? 0) + 1;
      this.attempts.set(step.id, attempt);
      const via = this.viaLabel(step, false);
      this.emit({ t: 'attempt-started', at: Date.now(), stepId: step.id, attempt, via });
      await this.wait(this.paceAttempt());

      const outcome = await this.resolveOutcome(step, attempt, false);
      if (outcome.type === 'interrupt') {
        this.handleInterrupt(step.id, outcome.message);
      }
      if (outcome.type === 'ok') {
        return { value: this.parseIfNeeded(step, outcome.value), recovered: attemptsUsedHere > 1 };
      }
      lastFailure = outcome.failure;
      this.failureKinds.add(outcome.failure.kind);
      this.emit({ t: 'attempt-failed', at: Date.now(), stepId: step.id, attempt, failure: outcome.failure });
      if (local < maxAttempts && outcome.failure.retryable) {
        this.retriesUsed++;
        this.setStatus(step.id, 'retrying');
        this.emit({ t: 'retry-scheduled', at: Date.now(), stepId: step.id, nextAttempt: attempt + 1 });
        continue;
      }
      break;
    }

    // Primary path exhausted — try the fallback, if one is attached.
    const fallback = step.upgrades.fallback;
    if (fallback) {
      const description = this.describeFallback(step, fallback);
      this.fallbacksActivated.push(description);
      this.emit({ t: 'fallback-activated', at: Date.now(), stepId: step.id, description });

      if (fallback.type === 'default') {
        const preset = this.o.kit.defaultValue(fallback.defaultId);
        this.emit({ t: 'default-used', at: Date.now(), stepId: step.id, value: clone(preset.value), label: preset.name });
        this.defaultsUsed++;
        return { value: clone(preset.value), recovered: true, degraded: true };
      }

      const attempt = (this.attempts.get(step.id) ?? 0) + 1;
      this.attempts.set(step.id, attempt);
      this.emit({ t: 'attempt-started', at: Date.now(), stepId: step.id, attempt, via: this.viaLabel(step, true) });
      await this.wait(this.paceAttempt());
      const outcome = await this.resolveOutcome(step, attempt, true);
      if (outcome.type === 'interrupt') {
        this.handleInterrupt(step.id, outcome.message);
      }
      if (outcome.type === 'ok') {
        return { value: this.parseIfNeeded(step, outcome.value), recovered: true };
      }
      lastFailure = outcome.failure;
      this.failureKinds.add(outcome.failure.kind);
      this.emit({ t: 'attempt-failed', at: Date.now(), stepId: step.id, attempt, failure: outcome.failure });
    }

    const failure = lastFailure ?? { kind: 'tool-error', message: 'Step failed', retryable: false };
    if (step.onExhausted === 'safe-stop') {
      this.safeStop(step.id, `"${step.label}" could not complete (${failure.message}). The workflow stopped safely instead of crashing.`);
    }
    this.setStatus(step.id, 'failed');
    throw new EndRun({ status: 'failed', stepId: step.id, failure });
  }

  private handleInterrupt(stepId: string, message: string): never {
    const checkpoint: Checkpoint = {
      workflowHash: hashWorkflow(this.o.workflow),
      sampleId: this.o.sampleId,
      scenarios: [...this.scenarios],
      completedStepIds: [...this.completedTopIds],
      outputs: clone(this.ctx.outputs),
      kinds: { ...this.ctx.kinds },
      last: clone(this.ctx.last),
      savedAt: Date.now(),
    };
    this.checkpointOut = checkpoint;
    this.failureKinds.add('interrupted');
    this.emit({ t: 'checkpoint-saved', at: Date.now(), afterStepId: this.completedTopIds[this.completedTopIds.length - 1] ?? '', completedSteps: this.completedTopIds.length });
    this.setStatus(stepId, 'failed');
    this.emit({ t: 'run-interrupted', at: Date.now(), stepId, message });
    throw new EndRun({ status: 'interrupted', stepId, message });
  }

  private viaLabel(step: ResilientStep, viaFallback: boolean): string {
    if (step.kind === 'ai') {
      const fb = step.upgrades.fallback;
      if (viaFallback && fb?.type === 'provider') return `fallback model: ${this.o.kit.provider(fb.providerId).name}`;
      const provider = this.o.kit.provider(step.providerId);
      return this.o.mode === 'live' ? `live: ${provider.name}` : `mock model: ${provider.name}`;
    }
    const fb = step.upgrades.fallback;
    if (viaFallback && fb?.type === 'tool') return `fallback tool: ${this.o.kit.tool(fb.toolId).name}`;
    return `simulated tool: ${this.o.kit.tool(step.toolId).name}`;
  }

  private describeFallback(step: ResilientStep, fallback: NonNullable<ResilientStep['upgrades']['fallback']>): string {
    if (fallback.type === 'provider') return `${step.label} → fallback model ${this.o.kit.provider(fallback.providerId).name}`;
    if (fallback.type === 'tool') return `${step.label} → fallback tool ${this.o.kit.tool(fallback.toolId).name}`;
    return `${step.label} → safe default "${this.o.kit.defaultValue(fallback.defaultId).name}"`;
  }

  private async resolveOutcome(step: ResilientStep, attempt: number, viaFallback: boolean): Promise<ModelOutcome> {
    if (step.kind === 'ai') {
      const aiStep = step as AiStep;
      const fb = aiStep.upgrades.fallback;
      const providerId = viaFallback && fb?.type === 'provider' ? fb.providerId : aiStep.providerId;
      const task = this.o.kit.task(aiStep.taskId);

      // Live mode: real call for the primary provider; the fallback provider
      // stays a clearly-labeled local mock so recovery remains reproducible.
      if (this.o.mode === 'live' && this.o.liveCall && !viaFallback) {
        try {
          const prompt = task.livePrompt?.(this.ctx) ?? `${task.description}\n\nInput:\n${JSON.stringify(this.ctx.last, null, 2)}`;
          const text = await this.o.liveCall(prompt, task.expectsJson);
          return { type: 'ok', value: text };
        } catch (err) {
          return {
            type: 'error',
            failure: {
              kind: 'provider-error',
              message: `Live provider call failed: ${err instanceof Error ? err.message : String(err)}`,
              retryable: true,
            },
          };
        }
      }

      return task.mock({
        taskId: aiStep.taskId,
        providerId,
        attempt,
        scenarios: this.scenarios,
        ctx: this.ctx,
        resumed: this.restoredIds.size > 0,
      });
    }

    const toolStep = step as ToolStep;
    const fb = toolStep.upgrades.fallback;
    const toolId = viaFallback && fb?.type === 'tool' ? fb.toolId : toolStep.toolId;
    return this.o.kit.tool(toolId).mock({
      toolId,
      attempt,
      scenarios: this.scenarios,
      ctx: this.ctx,
      resumed: this.restoredIds.size > 0,
    });
  }

  /** AI steps that expect JSON parse their raw text output; a parse failure
   *  becomes a *soft* malformed value that flows on for validators to catch. */
  private parseIfNeeded(step: ResilientStep, value: unknown): unknown {
    if (step.kind !== 'ai') return value;
    const task = this.o.kit.task(step.taskId);
    if (!task.expectsJson || typeof value !== 'string') return value;
    try {
      return JSON.parse(value.trim());
    } catch {
      return { malformed: true, raw: value };
    }
  }

  // -------------------------------------------------------------------------
  // Condition
  // -------------------------------------------------------------------------

  private async runCondition(step: ConditionStep): Promise<void> {
    const preset = this.o.kit.condition(step.conditionId);
    const result = preset.test(this.ctx);
    const branch = result.pass ? 'then' : 'else';
    const skipped = result.pass ? step.branches.else : step.branches.then;
    for (const s of flattenSteps(skipped)) this.setStatus(s.id, 'skipped');
    this.setStatus(step.id, 'completed');
    this.emit({ t: 'branch-taken', at: Date.now(), stepId: step.id, branch, reason: result.reason });
    this.emit({ t: 'step-completed', at: Date.now(), stepId: step.id, output: { branch, reason: result.reason }, durationMs: 0, recovered: false });
    await this.runSequence(step.branches[branch], false);
  }

  // -------------------------------------------------------------------------
  // Validator with escalation ladder
  // -------------------------------------------------------------------------

  private async runValidator(step: ValidatorStep, prev: WorkflowStep | undefined, startedAt: number): Promise<void> {
    const schemaPreset = this.o.kit.schema(step.schemaId);

    const check = () => validateAgainst(schemaPreset.schema, this.ctx.last);

    let outcome = check();
    this.recordValidation(step, prev, outcome.ok, outcome.issues, outcome.failureKinds);
    if (outcome.ok) {
      this.completeData(step.id, { valid: true, checked: schemaPreset.name }, startedAt, false);
      return;
    }

    // 1) Retry the previous step (if it is an AI/tool step).
    if (step.retryPrevious > 0 && prev && isResilient(prev)) {
      for (let r = 0; r < step.retryPrevious && !outcome.ok; r++) {
        this.retriesUsed++;
        this.setStatus(prev.id, 'retrying');
        this.emit({ t: 'retry-scheduled', at: Date.now(), stepId: prev.id, nextAttempt: (this.attempts.get(prev.id) ?? 0) + 1 });
        // Re-run the previous step against its ORIGINAL input, not its own bad output.
        this.ctx.last = clone(this.stepInputs[prev.id]);
        const rerun = await this.runResilient(prev);
        this.ctx.outputs[prev.id] = clone(rerun.value);
        this.ctx.last = clone(rerun.value);
        this.setStatus(prev.id, 'recovered');
        this.emit({ t: 'step-completed', at: Date.now(), stepId: prev.id, output: clone(rerun.value), durationMs: 0, recovered: true });
        outcome = check();
        this.recordValidation(step, prev, outcome.ok, outcome.issues, outcome.failureKinds);
      }
      if (outcome.ok) {
        this.completeData(step.id, { valid: true, fixedBy: 'retrying the previous step' }, startedAt, true);
        return;
      }
    }

    // 2) Deterministic repair. A repair that fixes only *some* of the problems is
    // still progress, so it is kept and the rest of the ladder continues on the
    // improved payload — discarding it would hand a human back defects a machine
    // had already corrected, and lose the repair note from the trace.
    if (step.repair && schemaPreset.repair) {
      const before = clone(this.ctx.last);
      const repaired = schemaPreset.repair(this.ctx.last);
      if (repaired && repaired.notes.length > 0) {
        const verdict = validateAgainst(schemaPreset.schema, repaired.value);
        this.repairsApplied++;
        this.ctx.last = clone(repaired.value);
        this.emit({
          t: 'repair-applied',
          at: Date.now(),
          stepId: step.id,
          notes: repaired.notes,
          before,
          after: clone(repaired.value),
          resolved: verdict.ok,
        });

        if (verdict.ok) {
          this.recordValidation(step, prev, true, [], []);
          this.completeData(step.id, { valid: true, fixedBy: 'automatic repair', notes: repaired.notes }, startedAt, true);
          return;
        }

        // Partial fix: whatever is still broken is what the next rung must solve.
        outcome = verdict;
        this.recordValidation(step, prev, false, verdict.issues, verdict.failureKinds);
      }
    }

    // 3) Safe default value.
    if (step.useDefault && step.defaultId) {
      const preset = this.o.kit.defaultValue(step.defaultId);
      this.defaultsUsed++;
      this.ctx.last = clone(preset.value);
      this.emit({ t: 'default-used', at: Date.now(), stepId: step.id, value: clone(preset.value), label: preset.name });
      this.completeData(step.id, { valid: true, fixedBy: `safe default "${preset.name}"` }, startedAt, true, true);
      return;
    }

    // 4) Escalate to a human.
    if (step.escalate) {
      const decision = await this.askHuman(step.id, {
        mode: 'fix',
        stepId: step.id,
        stepLabel: step.label,
        title: 'Validation failed — human help needed',
        instructions: `The output did not pass "${schemaPreset.name}". Fix the payload below, or reject to stop the workflow safely.`,
        allowEdit: true,
        schemaId: step.schemaId,
        payload: clone(this.ctx.last),
        issues: outcome.issues,
      });
      if (decision.action === 'edit') {
        const verdict = validateAgainst(schemaPreset.schema, decision.payload);
        if (verdict.ok) {
          this.ctx.last = clone(decision.payload);
          this.recordValidation(step, prev, true, [], []);
          this.completeData(step.id, { valid: true, fixedBy: 'human correction' }, startedAt, true);
          return;
        }
        this.safeStop(step.id, 'The human-edited payload still failed validation, so the workflow stopped safely.');
      }
      if (decision.action === 'reject') {
        this.safeStop(step.id, `A reviewer rejected the invalid output${decision.note ? `: "${decision.note}"` : '.'} The workflow stopped safely.`);
      }
      // 'approve' in fix mode means "accept as-is" — re-check honestly.
      const recheck = check();
      if (recheck.ok) {
        this.completeData(step.id, { valid: true, fixedBy: 'human approval' }, startedAt, true);
        return;
      }
    }

    // 5) Final action.
    if (step.finalAction === 'safe-stop') {
      this.safeStop(
        step.id,
        `Validation against "${schemaPreset.name}" failed and no recovery strategy fixed it. Stopped safely instead of passing bad data forward. Issues: ${outcome.issues.join('; ')}`,
      );
    }
    this.setStatus(step.id, 'failed');
    throw new EndRun({
      status: 'failed',
      stepId: step.id,
      failure: { kind: outcome.failureKinds[0] ?? 'schema', message: outcome.issues.join('; ') || 'Validation failed', retryable: false },
    });
  }

  private recordValidation(step: ValidatorStep, prev: WorkflowStep | undefined, ok: boolean, issues: string[], kinds: FailureKind[]) {
    if (ok) this.validationsPassed++;
    else this.validationsFailed++;
    for (const kind of kinds) this.failureKinds.add(kind);
    this.emit({ t: 'validation-result', at: Date.now(), stepId: step.id, targetStepId: prev?.id ?? '', ok, issues });
  }

  // -------------------------------------------------------------------------
  // Human review
  // -------------------------------------------------------------------------

  private async askHuman(stepId: string, prompt: HumanPrompt): Promise<HumanDecision> {
    this.setStatus(stepId, 'paused');
    this.emit({ t: 'paused-for-human', at: Date.now(), stepId, prompt });
    const decision = await this.raceAbort(this.o.human(prompt));
    this.emit({ t: 'human-decision', at: Date.now(), stepId, decision });
    this.humanDecisions.push({
      stepId,
      stepLabel: prompt.stepLabel,
      mode: prompt.mode,
      decision,
      at: Date.now(),
    });
    return decision;
  }

  private raceAbort<T>(promise: Promise<T>): Promise<T> {
    const signal = this.o.signal;
    if (!signal) return promise;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new EndRun({ status: 'aborted' }));
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (err) => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });
  }

  private async runHuman(step: HumanStep, startedAt: number): Promise<void> {
    const decision = await this.askHuman(step.id, {
      mode: 'approval',
      stepId: step.id,
      stepLabel: step.label,
      title: step.title,
      instructions: step.instructions,
      allowEdit: step.allowEdit,
      schemaId: step.schemaId,
      payload: clone(this.ctx.last),
    });

    if (decision.action === 'reject') {
      this.failureKinds.add('rejected');
      this.safeStop(step.id, `Rejected by the reviewer${decision.note ? `: "${decision.note}"` : '.'} Nothing was sent or executed after this point.`);
    }

    if (decision.action === 'edit' && step.schemaId) {
      const verdict = validateAgainst(this.o.kit.schema(step.schemaId).schema, decision.payload);
      if (!verdict.ok) {
        this.safeStop(step.id, `The reviewer's edit failed validation (${verdict.issues.join('; ')}), so the workflow stopped safely.`);
      }
    }

    const payload = clone(decision.action === 'edit' ? decision.payload : this.ctx.last);
    this.completeData(
      step.id,
      { decision: decision.action === 'edit' ? 'edited & approved' : 'approved', note: decision.note ?? '', payload: clone(payload) },
      startedAt,
      false,
    );
    // completeData records the decision wrapper as this step's output; downstream steps
    // should receive the reviewed payload itself, so restore it here.
    this.ctx.last = payload;
  }
}
