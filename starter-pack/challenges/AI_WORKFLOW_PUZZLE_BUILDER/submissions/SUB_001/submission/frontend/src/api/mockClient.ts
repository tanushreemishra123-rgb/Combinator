/**
 * `MockApiClient` - the whole API served from in-browser fixtures.
 *
 * Enabled with `VITE_MOCK_API=1`. It exists so the builder, the live trace,
 * human review, resume and the reliability report can all be demonstrated end
 * to end without the backend. Response *shapes* follow the contract exactly;
 * the rules behind them (validation specifics, scoring) are backend-internal
 * and only plausibly approximated here - see `mockEngine.ts`.
 */

import type { ApiClient, RunEventHandlers, RunEventStream } from './client'
import { ApiError } from './errors'
import { MOCK_HEALTH, MOCK_PUZZLES } from './fixtures'
import { buildReport, planReviewDecision, planRun, type PlannedStep, type RunPlan } from './mockEngine'
import { CATALOG } from '../blocks/catalog'
import type {
  CreateRunRequest,
  HealthResponse,
  NodeDef,
  PuzzleDetail,
  PuzzleSummary,
  ReliabilityReport,
  ReviewDecisionRequest,
  RunAccepted,
  RunSummary,
  TraceEvent,
  ValidateWorkflowResponse,
  ValidationMessage,
  WorkflowDef,
} from './types'

const NETWORK_LATENCY_MS = 180

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface MockRun {
  summary: RunSummary
  workflow: WorkflowDef
  plan: RunPlan
  /** Steps not yet emitted on any stream. */
  pending: PlannedStep[]
  seq: number
}

/* ------------------------------------------------------------------ */
/* Structural validation (stand-in for the backend's rules)            */
/* ------------------------------------------------------------------ */

export function validateWorkflowLocally(workflow: WorkflowDef): ValidateWorkflowResponse {
  const errors: ValidationMessage[] = []
  const warnings: ValidationMessage[] = []
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]))

  const inputs = workflow.nodes.filter((n) => n.type === 'input')
  const outputs = workflow.nodes.filter((n) => n.type === 'output')

  if (inputs.length === 0) {
    errors.push({ code: 'no_input', message: 'Every workflow needs an Input block to start from.' })
  }
  if (inputs.length > 1) {
    errors.push({
      code: 'multiple_inputs',
      message: 'A workflow can only have one Input block.',
      node_id: inputs[1]?.id,
    })
  }
  if (outputs.length === 0 && !workflow.nodes.some((n) => n.type === 'safe_stop')) {
    errors.push({
      code: 'no_output',
      message: 'Add an Output block (or a Safe Stop) so the workflow has somewhere to end.',
    })
  }

  for (const edge of workflow.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      errors.push({
        code: 'dangling_edge',
        message: 'A connection points at a block that no longer exists.',
        edge_id: edge.id,
      })
    }
  }

  // Required config fields, straight from the catalog descriptors.
  for (const node of workflow.nodes) {
    for (const field of CATALOG[node.type].fields) { // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: CATALOG is Record<BlockType, …> and node.type is that union, not user input
      if (!field.required) continue
      const value = node.config[field.name] // nosemgrep: gitlab.eslint.detect-object-injection -- field.name comes from the catalog descriptor, not user input
      if (value === undefined || value === null || value === '') {
        errors.push({
          code: 'missing_config',
          message: `${node.label ?? CATALOG[node.type].displayName} needs a value for "${field.label}".`, // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: CATALOG is Record<BlockType, …>, not user input
          node_id: node.id,
        })
      }
    }
  }

  // Fan-out rules.
  for (const node of workflow.nodes) {
    const outgoing = workflow.edges.filter((e) => e.source === node.id)
    const incoming = workflow.edges.filter((e) => e.target === node.id)
    const meta = CATALOG[node.type] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: CATALOG is Record<BlockType, …>, not user input

    if (node.type === 'condition') {
      const branches = new Set(outgoing.map((e) => e.sourceHandle ?? 'true'))
      if (!branches.has('true') || !branches.has('false')) {
        errors.push({
          code: 'condition_branches',
          message: 'A Condition needs both a true and a false branch connected.',
          node_id: node.id,
        })
      }
    } else if (meta.allowsOutgoing && outgoing.length > 1) {
      errors.push({
        code: 'multiple_outgoing',
        message: `${node.label ?? meta.displayName} has more than one next step. Only a Condition can branch.`,
        node_id: node.id,
      })
    }

    if (meta.allowsOutgoing && outgoing.length === 0 && node.type !== 'output') {
      warnings.push({
        code: 'dead_end',
        message: `${node.label ?? meta.displayName} does not lead anywhere yet.`,
        node_id: node.id,
      })
    }
    if (meta.allowsIncoming && incoming.length === 0) {
      warnings.push({
        code: 'unreachable',
        message: `${node.label ?? meta.displayName} is not connected to the workflow.`,
        node_id: node.id,
      })
    }

    if (meta.isGuard && outgoing.length === 0) {
      errors.push({
        code: 'guard_protects_nothing',
        message: `${meta.displayName} must sit directly before the step it protects.`,
        node_id: node.id,
      })
    }
  }

  const hasModel = workflow.nodes.some((n) => n.type === 'ai_model')
  const hasValidator = workflow.nodes.some((n) => n.type === 'validator')
  if (hasModel && !hasValidator) {
    warnings.push({
      code: 'unguarded_model',
      message: 'No validator checks the AI output - malformed answers will reach the output.',
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/* ------------------------------------------------------------------ */
/* Streaming                                                           */
/* ------------------------------------------------------------------ */

class MockEventStream implements RunEventStream {
  private readonly subscribers = new Set<RunEventHandlers>()
  private readonly history: Array<(handlers: RunEventHandlers) => void> = []
  private closed = false
  private started = false
  private readonly run: MockRun
  private readonly onPauseOrFinish: (run: MockRun) => void

  constructor(run: MockRun, onPauseOrFinish: (run: MockRun) => void) {
    this.run = run
    this.onPauseOrFinish = onPauseOrFinish
  }

  subscribe(handlers: RunEventHandlers): () => void {
    for (const apply of this.history) apply(handlers)
    this.subscribers.add(handlers)
    if (!this.started) {
      this.started = true
      void this.play()
    }
    return () => {
      this.subscribers.delete(handlers)
    }
  }

  close(): void {
    this.closed = true
    this.subscribers.clear()
  }

  private emit(apply: (handlers: RunEventHandlers) => void): void {
    this.history.push(apply)
    for (const handlers of this.subscribers) apply(handlers)
  }

  private async play(): Promise<void> {
    // Contract: the stream replays every recorded event from seq 1 first.
    for (const recorded of this.run.summary.trace) {
      this.emit((handlers) => handlers.onTrace?.(recorded))
    }

    while (this.run.pending.length > 0) {
      const next = this.run.pending[0]
      if (!next) break
      await sleep(next.delayMs)
      if (this.closed) return
      this.run.pending.shift()

      const event: TraceEvent = {
        ...next.event,
        seq: ++this.run.seq,
        run_id: this.run.summary.run_id,
        timestamp: new Date().toISOString(),
      }
      this.run.summary.trace.push(event)
      this.emit((handlers) => handlers.onTrace?.(event))
    }

    this.onPauseOrFinish(this.run)
    const summary = structuredClone(this.run.summary)
    if (summary.status === 'paused') {
      this.emit((handlers) => handlers.onPaused?.(summary))
    } else {
      this.emit((handlers) => handlers.onDone?.(summary))
    }
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export class MockApiClient implements ApiClient {
  private readonly runs = new Map<string, MockRun>()
  private runCounter = 0

  async getHealth(): Promise<HealthResponse> {
    await sleep(NETWORK_LATENCY_MS)
    return { ...MOCK_HEALTH }
  }

  async listPuzzles(): Promise<PuzzleSummary[]> {
    await sleep(NETWORK_LATENCY_MS)
    return MOCK_PUZZLES.map(
      ({ id, title, difficulty, tagline, concepts, order }): PuzzleSummary => ({
        id,
        title,
        difficulty,
        tagline,
        concepts,
        order,
      }),
    )
  }

  async getPuzzle(id: string): Promise<PuzzleDetail> {
    await sleep(NETWORK_LATENCY_MS)
    const puzzle = MOCK_PUZZLES.find((candidate) => candidate.id === id)
    if (!puzzle) throw new ApiError(404, `No puzzle with id "${id}"`)
    return structuredClone(puzzle)
  }

  async validateWorkflow(workflow: WorkflowDef): Promise<ValidateWorkflowResponse> {
    await sleep(NETWORK_LATENCY_MS)
    return validateWorkflowLocally(workflow)
  }

  async createRun(request: CreateRunRequest): Promise<RunAccepted> {
    await sleep(NETWORK_LATENCY_MS)
    const runId = `run_mock_${++this.runCounter}`
    const workflow = structuredClone(request.workflow)
    const puzzleId = request.puzzle_id ?? null
    const scenarioId = request.scenario_id ?? null
    const plan = planRun({ workflow, puzzleId, scenarioId })

    // The engine plans against `null` input; fill in what the caller sent.
    const first = plan.steps[0]
    if (first?.event.event === 'run_started') {
      first.event.payload = {
        ...first.event.payload,
        input: request.input ?? MOCK_PUZZLES.find((p) => p.id === puzzleId)?.sample_input ?? null,
      }
    }

    this.runs.set(runId, {
      seq: 0,
      workflow,
      plan,
      pending: [...plan.steps],
      summary: {
        run_id: runId,
        puzzle_id: puzzleId,
        status: 'running',
        scenario_id: scenarioId,
        result: null,
        error: null,
        pending_review: null,
        resumed_from: null,
        trace: [],
      },
    })
    return { run_id: runId }
  }

  streamRunEvents(runId: string): RunEventStream {
    const run = this.requireRun(runId)
    return new MockEventStream(run, (finished) => this.settle(finished))
  }

  async getRun(runId: string): Promise<RunSummary> {
    await sleep(NETWORK_LATENCY_MS)
    return structuredClone(this.requireRun(runId).summary)
  }

  async submitReview(runId: string, decision: ReviewDecisionRequest): Promise<RunAccepted> {
    await sleep(NETWORK_LATENCY_MS)
    const run = this.requireRun(runId)
    if (run.summary.status !== 'paused') throw new ApiError(409, 'That run is not waiting for a decision.')

    const pausedAt = run.plan.pausedAtNodeId
    const node = run.plan.order.find((candidate) => candidate.id === pausedAt) ?? null

    run.summary.status = 'running'
    run.summary.pending_review = null
    run.pending = planReviewDecision(node, decision.action, decision.note ?? null, decision.edited_data)

    if (decision.action !== 'reject' && pausedAt) {
      const rest = planRun({
        workflow: run.workflow,
        puzzleId: run.summary.puzzle_id,
        scenarioId: run.summary.scenario_id,
        startAfterNodeId: pausedAt,
        suppressIncidents: true,
      })
      run.pending = [...run.pending, ...rest.steps]
    }
    return { run_id: runId }
  }

  async resumeLast(runId: string): Promise<RunAccepted> {
    await sleep(NETWORK_LATENCY_MS)
    const source = this.requireRun(runId)
    const cloneId = `run_mock_${++this.runCounter}`

    // Everything that already succeeded is replayed as `step_skipped`.
    const done = new Set(
      source.summary.trace
        .filter((event) => event.status === 'completed' || event.status === 'recovered')
        .map((event) => event.node_id)
        .filter((nodeId): nodeId is string => Boolean(nodeId)),
    )

    const plan = planRun({
      workflow: source.workflow,
      puzzleId: source.summary.puzzle_id,
      scenarioId: source.summary.scenario_id,
      skip: [...done],
      suppressIncidents: true,
    })

    this.runs.set(cloneId, {
      seq: 0,
      workflow: source.workflow,
      plan,
      pending: [...plan.steps],
      summary: {
        run_id: cloneId,
        puzzle_id: source.summary.puzzle_id,
        status: 'running',
        scenario_id: source.summary.scenario_id,
        result: null,
        error: null,
        pending_review: null,
        resumed_from: runId,
        trace: [],
      },
    })
    return { run_id: cloneId }
  }

  async getReliability(runId: string): Promise<ReliabilityReport> {
    await sleep(NETWORK_LATENCY_MS)
    const run = this.requireRun(runId)
    if (run.summary.status === 'running' || run.summary.status === 'paused') {
      throw new ApiError(409, 'The run is still in progress.')
    }

    const puzzle = MOCK_PUZZLES.find((candidate) => candidate.id === run.summary.puzzle_id)
    return buildReport({
      runId,
      puzzleId: run.summary.puzzle_id,
      workflow: run.workflow,
      trace: run.summary.trace,
      status: run.summary.status,
      scenarioId: run.summary.scenario_id,
      resumedFrom: run.summary.resumed_from,
      completionCriteria: puzzle?.completion_criteria ?? [],
    })
  }

  private requireRun(runId: string): MockRun {
    const run = this.runs.get(runId)
    if (!run) throw new ApiError(404, `No run with id "${runId}"`)
    return run
  }

  /** Derive the terminal/paused summary once the script is exhausted. */
  private settle(run: MockRun): void {
    const last = run.summary.trace.at(-1)
    switch (last?.event) {
      case 'run_paused': {
        const node = run.plan.order.find((candidate) => candidate.id === run.plan.pausedAtNodeId) ?? null
        run.summary.status = 'paused'
        run.summary.pending_review = buildReviewRequest(node, run.summary.trace)
        break
      }
      case 'run_safe_stopped':
        run.summary.status = 'safely_stopped'
        run.summary.result = null
        break
      case 'run_failed': {
        const error = last.payload.error
        run.summary.status = 'failed'
        run.summary.error =
          error && typeof error === 'object' && 'kind' in error && 'message' in error
            ? { kind: String((error as { kind: unknown }).kind), message: String((error as { message: unknown }).message) }
            : { kind: 'step_failed', message: 'A step failed with no guard to recover it.' }
        break
      }
      default:
        run.summary.status = 'completed'
        run.summary.result =
          run.summary.trace.findLast((event) => typeof event.payload.output !== 'undefined')?.payload.output ?? null
    }
  }
}

/** The data a paused run hands to the review modal: the last real output. */
function buildReviewRequest(node: NodeDef | null, trace: TraceEvent[]) {
  const lastOutput = trace.findLast((event) => typeof event.payload.output !== 'undefined')?.payload.output ?? null
  const requested = trace.findLast((event) => event.event === 'review_requested')
  const review = requested?.payload.review
  const prompt =
    review && typeof review === 'object' && 'prompt' in review
      ? String((review as { prompt: unknown }).prompt)
      : 'Does this look right?'
  const allowed =
    review && typeof review === 'object' && Array.isArray((review as { allowed_actions?: unknown }).allowed_actions)
      ? ((review as { allowed_actions: unknown[] }).allowed_actions.map(String))
      : ['approve', 'edit', 'reject']

  return {
    node_id: node?.id ?? 'human_review',
    node_label: node?.label ?? 'Human Review',
    prompt,
    data: lastOutput,
    allowed_actions: allowed,
    validation: null,
  }
}
