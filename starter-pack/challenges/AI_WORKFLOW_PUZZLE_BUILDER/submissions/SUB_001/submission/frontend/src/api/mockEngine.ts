/**
 * The mock run engine.
 *
 * `MockApiClient` does not replay hand-written event lists: it walks the
 * workflow the user actually built and decorates that walk with the incidents
 * of the first matching profile in `RUN_PROFILES`. That keeps every scripted
 * demo (retry → recovered, review pause, fallback rescue, validate-and-repair,
 * unguarded failure → resume) data-driven, and makes the trace line up with
 * the nodes on the canvas whatever the user assembled.
 *
 * Everything here is fixture logic. The real backend owns the real rules.
 */

import {
  CRITERION_RULES,
  DEFAULT_STEP_OUTPUTS,
  GRADE_RULES,
  INCIDENT_ERRORS,
  INSIGHT_RULES,
  REPAIR_ISSUES,
  RUN_PROFILES,
  SCORE_RULES,
  STEP_OUTPUTS,
  type IncidentKind,
  type RunFacts,
  type RunProfile,
} from './fixtures'
import type {
  BlockType,
  EventType,
  NodeDef,
  ReliabilityReport,
  StepStatus,
  TraceEvent,
  WorkflowDef,
} from './types'

/** One step of a planned run: the wait before it, then the event itself. */
export interface PlannedStep {
  delayMs: number
  event: Omit<TraceEvent, 'seq' | 'run_id' | 'timestamp'>
}

export interface PlanOptions {
  workflow: WorkflowDef
  puzzleId: string | null
  scenarioId: string | null
  /** Node ids already completed by an earlier run - replayed as `step_skipped`. */
  skip?: string[]
  /** Resume runs re-execute cleanly: no incidents the second time around. */
  suppressIncidents?: boolean
  /** Start the walk after this node (used when a review decision resumes a run). */
  startAfterNodeId?: string
}

export interface RunPlan {
  profile: RunProfile
  /** Execution order of the walked nodes. */
  order: NodeDef[]
  steps: PlannedStep[]
  /** Node the run pauses on, when the plan ends in a review pause. */
  pausedAtNodeId: string | null
}

const GUARD_TYPES: BlockType[] = ['retry', 'timeout', 'fallback']

/* ------------------------------------------------------------------ */
/* Walking the workflow                                                */
/* ------------------------------------------------------------------ */

/** Linear walk from the Input block, taking the `true` branch at conditions. */
export function executionOrder(workflow: WorkflowDef): NodeDef[] {
  const byId = new Map(workflow.nodes.map((node) => [node.id, node]))
  const seen = new Set<string>()
  const order: NodeDef[] = []

  let current: NodeDef | undefined = workflow.nodes.find((node) => node.type === 'input') ?? workflow.nodes[0]
  while (current && !seen.has(current.id)) {
    const node: NodeDef = current
    seen.add(node.id)
    order.push(node)
    const outgoing = workflow.edges.filter((edge) => edge.source === node.id)
    const next = outgoing.find((edge) => (edge.sourceHandle ?? 'true') === 'true') ?? outgoing[0]
    current = next ? byId.get(next.target) : undefined
  }
  return order
}

function stepOutput(puzzleId: string | null, node: NodeDef): unknown {
  const perPuzzle = puzzleId ? STEP_OUTPUTS[puzzleId] : undefined // nosemgrep: gitlab.eslint.detect-object-injection -- fixture lookup by puzzle id in a static table; a miss is `undefined` and falls through below
  return perPuzzle?.[node.type] ?? DEFAULT_STEP_OUTPUTS[node.type] ?? { ok: true } // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: node.type is the BlockType union, not user input
}

/* ------------------------------------------------------------------ */
/* Profile selection                                                   */
/* ------------------------------------------------------------------ */

export function pickProfile(workflow: WorkflowDef, scenarioId: string | null): RunProfile {
  const present = new Set(workflow.nodes.map((node) => node.type))
  const fallback = RUN_PROFILES[RUN_PROFILES.length - 1] // nosemgrep: gitlab.eslint.detect-object-injection -- array index computed from the array's own length, not user input

  const matched = RUN_PROFILES.find(({ match }) => {
    if (match.scenario === 'armed' && !scenarioId) return false
    if (match.scenario === 'off' && scenarioId) return false
    if (match.requires?.some((type) => !present.has(type))) return false
    if (match.forbids?.some((type) => present.has(type))) return false
    return true
  })

  // RUN_PROFILES always ends in a catch-all, so this is belt and braces.
  return matched ?? fallback ?? { id: 'clean_pass', label: 'Ran cleanly', match: {}, incidents: [] }
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

interface Emitter {
  steps: PlannedStep[]
  push: (
    delayMs: number,
    node: NodeDef | null,
    event: EventType,
    status: StepStatus,
    payload: Record<string, unknown>,
  ) => void
}

function emitter(): Emitter {
  const steps: PlannedStep[] = []
  return {
    steps,
    push: (delayMs, node, event, status, payload) => {
      steps.push({
        delayMs,
        event: {
          node_id: node?.id ?? null,
          node_label: node?.label ?? null,
          node_type: node?.type ?? null,
          event,
          status,
          payload,
        },
      })
    },
  }
}

/**
 * Block meta as the real engine emits it: spread at the TOP level of the
 * step's terminal payload, never under `meta` (see the TraceEvent note in ./types.ts).
 */
function modelMeta(provider: string): Record<string, unknown> {
  return { provider_used: provider, mocked: true, confidence: 0.9 }
}

/** Where each incident attaches: the first walked node of an accepted type. */
function incidentTargets(profile: RunProfile, order: NodeDef[]): Map<string, IncidentKind> {
  const targets = new Map<string, IncidentKind>()
  for (const incident of profile.incidents) {
    const node = order.find((candidate) => incident.on.includes(candidate.type) && !targets.has(candidate.id))
    if (node) targets.set(node.id, incident.kind)
  }
  return targets
}

/** Emits the incident's events and reports whether the walk should stop here. */
function playIncident(
  out: Emitter,
  kind: IncidentKind,
  node: NodeDef,
  puzzleId: string | null,
  guards: Set<BlockType>,
): { halt: boolean } {
  const error = INCIDENT_ERRORS[kind] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: kind is the IncidentKind union, not user input

  switch (kind) {
    case 'retry_recovered': {
      const attempts = 2
      out.push(620, node, 'step_failed', 'failed', { attempt: 1, error })
      out.push(340, node, 'step_retrying', 'retrying', {
        attempt: attempts,
        max_attempts: attempts,
        recovery_action: 'retry',
      })
      out.push(620, node, 'step_recovered', 'recovered', {
        attempt: attempts,
        output: stepOutput(puzzleId, node),
        recovery_action: 'retry',
        ...(node.type === 'ai_model' ? modelMeta('mock-deterministic') : {}),
      })
      return { halt: false }
    }

    case 'fallback_rescue': {
      out.push(600, node, 'step_failed', 'failed', { attempt: 1, error })
      out.push(320, node, 'fallback_used', 'retrying', {
        recovery_action: 'fallback',
        fallback: { mode: 'alternate_provider', provider: 'mock-backup' },
        ...modelMeta('mock-backup'),
      })
      out.push(560, node, 'step_recovered', 'recovered', {
        attempt: 2,
        output: stepOutput(puzzleId, node),
        recovery_action: 'fallback',
        ...modelMeta('mock-backup'),
      })
      return { halt: false }
    }

    case 'validation_repair': {
      out.push(480, node, 'validation_result', 'failed', {
        passed: false,
        issues: REPAIR_ISSUES,
        error,
      })
      out.push(340, node, 'step_retrying', 'retrying', {
        attempt: 2,
        // The backend emits a dedicated step_repairing event for a validator repair
        // round; this pre-backend demo engine only labels the recovery action.
        recovery_action: guards.has('retry') ? 'retry_upstream' : 'repair',
      })
      out.push(560, node, 'validation_result', 'recovered', {
        attempt: 2,
        passed: true,
        issues: [],
        output: stepOutput(puzzleId, node),
      })
      return { halt: false }
    }

    case 'review_pause': {
      out.push(420, node, 'review_requested', 'paused', {
        review: {
          prompt: readPrompt(node) ?? 'Does this look right to send?',
          allowed_actions: readActions(node),
        },
      })
      out.push(180, null, 'run_paused', 'paused', {})
      return { halt: true }
    }

    case 'hard_failure':
    default: {
      out.push(680, node, 'step_failed', 'failed', { attempt: 1, error })
      out.push(220, null, 'run_failed', 'failed', { error })
      return { halt: true }
    }
  }
}

function readPrompt(node: NodeDef): string | null {
  const prompt = node.config.prompt
  return typeof prompt === 'string' && prompt.trim() !== '' ? prompt : null
}

function readActions(node: NodeDef): string[] {
  const allowed = node.config.allowed_actions
  if (Array.isArray(allowed) && allowed.length > 0) return allowed.map(String)
  return ['approve', 'edit', 'reject']
}

/**
 * Plan a run: replay skipped nodes, then walk the remaining ones emitting
 * start/complete pairs with the profile's incidents woven in.
 */
export function planRun(options: PlanOptions): RunPlan {
  const { workflow, puzzleId, scenarioId, skip = [], suppressIncidents = false, startAfterNodeId } = options
  const profile = pickProfile(workflow, scenarioId)
  const order = executionOrder(workflow)
  const guards = new Set(workflow.nodes.map((node) => node.type).filter((type) => GUARD_TYPES.includes(type)))
  const targets = suppressIncidents ? new Map<string, IncidentKind>() : incidentTargets(profile, order)

  const out = emitter()
  const skipped = new Set(skip)
  const resumeIndex = startAfterNodeId ? order.findIndex((node) => node.id === startAfterNodeId) + 1 : 0

  if (resumeIndex === 0) {
    out.push(140, null, 'run_started', 'running', {
      input: null,
      scenario_id: scenarioId,
      profile: profile.label,
    })
  }

  let pausedAtNodeId: string | null = null

  for (const [index, node] of order.entries()) {
    if (index < resumeIndex) continue

    if (skipped.has(node.id)) {
      out.push(150, node, 'step_skipped', 'skipped', {
        reason: 'Already completed successfully in the previous run.',
      })
      continue
    }

    if (GUARD_TYPES.includes(node.type)) {
      const protects = order[index + 1] // nosemgrep: gitlab.eslint.detect-object-injection -- array index from the enclosing loop counter, not user input
      out.push(180, node, 'step_completed', 'completed', {
        guard: node.type,
        protects: protects?.label ?? null,
        config: node.config,
      })
      continue
    }

    out.push(280, node, 'step_started', 'running', { attempt: 1, config: node.config })

    const incident = targets.get(node.id)
    if (incident) {
      const { halt } = playIncident(out, incident, node, puzzleId, guards)
      if (halt) {
        pausedAtNodeId = incident === 'review_pause' ? node.id : null
        return { profile, order, steps: out.steps, pausedAtNodeId }
      }
      continue
    }

    if (node.type === 'safe_stop') {
      const message = typeof node.config.message === 'string' ? node.config.message : 'Stopped on purpose.'
      out.push(360, node, 'step_completed', 'safely_stopped', { message, reason: node.config.reason ?? null })
      out.push(200, null, 'run_safe_stopped', 'safely_stopped', { message })
      return { profile, order, steps: out.steps, pausedAtNodeId: null }
    }

    out.push(node.type === 'ai_model' ? 700 : 420, node, 'step_completed', 'completed', {
      attempt: 1,
      output: stepOutput(puzzleId, node),
      ...(node.type === 'validator' ? { validation: { passed: true, issues: [] } } : {}),
      ...(node.type === 'ai_model' ? modelMeta('mock-deterministic') : {}),
    })
  }

  out.push(240, null, 'run_completed', 'completed', {})
  return { profile, order, steps: out.steps, pausedAtNodeId }
}

/** The events a review decision adds before the run picks back up. */
export function planReviewDecision(
  node: NodeDef | null,
  action: 'approve' | 'edit' | 'reject',
  note: string | null,
  editedData: unknown,
): PlannedStep[] {
  const out = emitter()
  out.push(220, node, 'review_decision', action === 'reject' ? 'safely_stopped' : 'completed', {
    review: { action, note, ...(action === 'edit' ? { edited_data: editedData } : {}) },
  })

  if (action === 'reject') {
    const message = note?.trim()
      ? `the reviewer rejected this - “${note.trim()}”`
      : 'the reviewer rejected this, so nothing was sent'
    out.push(280, null, 'run_safe_stopped', 'safely_stopped', { message, reason: 'human_rejection' })
  } else {
    out.push(200, null, 'run_resumed', 'running', { recovery_action: 'human_decision' })
  }
  return out.steps
}

/* ------------------------------------------------------------------ */
/* Reliability report                                                  */
/* ------------------------------------------------------------------ */

export function collectFacts(
  trace: TraceEvent[],
  workflow: WorkflowDef,
  status: string,
  scenarioId: string | null,
  resumedFrom: string | null,
): RunFacts {
  const has = (event: EventType) => trace.some((entry) => entry.event === event)
  return {
    completed: status === 'completed',
    failed: status === 'failed',
    safeStopped: status === 'safely_stopped',
    retriesUsed: trace.filter((entry) => entry.event === 'step_retrying').length,
    fallbackUsed: has('fallback_used'),
    humanReviewUsed: has('review_requested'),
    safeStopUsed: status === 'safely_stopped',
    validationRan: has('validation_result') || workflow.nodes.some((node) => node.type === 'validator'),
    scenarioArmed: Boolean(scenarioId),
    resumed: Boolean(resumedFrom),
    blocks: new Set(workflow.nodes.map((node) => node.type)),
  }
}

export function buildReport(input: {
  runId: string
  puzzleId: string | null
  workflow: WorkflowDef
  trace: TraceEvent[]
  status: string
  scenarioId: string | null
  resumedFrom: string | null
  completionCriteria: string[]
}): ReliabilityReport {
  const facts = collectFacts(input.trace, input.workflow, input.status, input.scenarioId, input.resumedFrom)

  const score = Math.max(
    0,
    Math.min(100, SCORE_RULES.reduce((total, rule) => (rule.when(facts) ? total + rule.points : total), 0)),
  )
  // nosemgrep: gitlab.eslint.detect-object-injection -- array index computed from the array's own length, not user input
  const grade = (GRADE_RULES.find((rule) => rule.when(facts)) ?? GRADE_RULES[GRADE_RULES.length - 1])?.grade ?? 'broken'

  const insights = INSIGHT_RULES.filter((rule) => rule.when(facts))
  const completion = input.completionCriteria.map((criterion) => {
    const rule = CRITERION_RULES.find((candidate) => candidate.match.test(criterion))
    return { criterion, met: rule ? rule.when(facts) : facts.completed }
  })

  const unhandled = input.trace
    .filter((entry) => entry.event === 'run_failed')
    .map((entry) => {
      const error = entry.payload.error
      return error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'The run ended on an unhandled error.'
    })

  return {
    run_id: input.runId,
    puzzle_id: input.puzzleId,
    grade,
    score,
    completed: facts.completed,
    output_valid: facts.completed ? true : facts.safeStopped ? null : false,
    injected_failure_handled: facts.scenarioArmed ? facts.completed || facts.safeStopped : null,
    retries_used: facts.retriesUsed,
    repairs_used: 0,
    fallback_used: facts.fallbackUsed,
    human_review_used: facts.humanReviewUsed,
    safe_stop_used: facts.safeStopUsed,
    unhandled_errors: unhandled,
    strengths: insights.filter((rule) => rule.tone === 'strength').map((rule) => rule.text),
    weaknesses: insights.filter((rule) => rule.tone === 'weakness').map((rule) => rule.text),
    completion,
    puzzle_solved: completion.length > 0 && completion.every((entry) => entry.met),
  }
}
