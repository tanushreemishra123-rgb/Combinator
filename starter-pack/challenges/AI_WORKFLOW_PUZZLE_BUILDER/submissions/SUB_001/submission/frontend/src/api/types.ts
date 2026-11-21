/**
 * TypeScript shapes of the backend HTTP API (mirrors backend/app/api/schemas.py).
 *
 * Names and field names are verbatim from the contract. Nothing here may drift
 * from that document - if a shape needs to change, the contract changes first.
 *
 * The only additions are (a) request/response envelopes the contract describes
 * inline rather than naming, and (b) optional per-block config interfaces used
 * by the block catalog for typed defaults. Both are marked below.
 */

/* ------------------------------------------------------------------ */
/* Core shapes                                                         */
/* ------------------------------------------------------------------ */

export type BlockType =
  | 'input'
  | 'ai_model'
  | 'tool'
  | 'retrieval'
  | 'condition'
  | 'transform'
  | 'validator'
  | 'human_review'
  | 'safe_stop'
  | 'output'
  | 'retry'
  | 'timeout'
  | 'fallback' // guard types

export interface WorkflowDef {
  id: string
  name: string
  nodes: NodeDef[]
  edges: EdgeDef[]
}

export interface NodeDef {
  id: string
  type: BlockType
  label?: string | null
  config: Record<string, unknown> // per-block config, see "Block configs"
  position?: { x: number; y: number } | null // canvas-only; engine ignores it
}

export interface EdgeDef {
  id: string
  source: string
  target: string
  sourceHandle?: 'true' | 'false' | null // condition branches only
}

/* ------------------------------------------------------------------ */
/* Trace events                                                        */
/* ------------------------------------------------------------------ */

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'retrying'
  | 'recovered'
  | 'safely_stopped'
  | 'skipped'

export type EventType =
  | 'run_started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_retrying'
  | 'step_repairing'
  | 'step_recovered'
  | 'step_skipped'
  | 'validation_result'
  | 'review_requested'
  | 'review_decision'
  | 'fallback_used'
  | 'run_paused'
  | 'run_resumed'
  | 'run_completed'
  | 'run_failed'
  | 'run_safe_stopped'

export interface TraceEvent {
  seq: number // strictly increasing from 1
  run_id: string
  node_id: string | null
  node_label: string | null
  node_type: BlockType | null
  event: EventType
  status: StepStatus
  timestamp: string // ISO 8601
  payload: Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export type RunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'safely_stopped'

export interface RunError {
  kind: string
  message: string
  detail?: object
}

export interface RunSummary {
  run_id: string
  puzzle_id: string | null
  status: RunStatus
  scenario_id: string | null
  result: unknown
  error: RunError | null
  pending_review: ReviewRequest | null
  resumed_from: string | null
  trace: TraceEvent[]
}

export interface ReviewRequest {
  node_id: string
  node_label: string
  prompt: string
  data: unknown
  allowed_actions: string[]
  validation?: { passed: boolean; issues: ValidationIssue[] } | null
}

export interface ValidationIssue {
  field: string | null
  code: string
  message: string
  expected?: unknown
  actual?: unknown
}

/* ------------------------------------------------------------------ */
/* Puzzles                                                             */
/* ------------------------------------------------------------------ */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface PuzzleSummary {
  id: string
  title: string
  difficulty: Difficulty
  tagline: string // one-line hook, e.g. "Survive the timeout"
  concepts: string[] // e.g. ["retry", "timeout"]
  order: number
}

export interface PuzzleDetail extends PuzzleSummary {
  objective: string // friendly puzzle language
  description: string
  sample_input: unknown
  expected_output: string // human-readable description of success shape
  available_blocks: BlockType[]
  starter_workflow: WorkflowDef // possibly broken/incomplete - that's the puzzle
  solution_hint?: string
  failure_scenarios: FailureScenario[]
  completion_criteria: string[] // shown to the user, also evaluated server-side
  /** Simulated tools usable in this puzzle (drives a select for tool.tool; absent → free text). */
  tools?: { name: string; description: string }[]
}

export interface FailureScenario {
  id: string
  label: string
  description: string
}

/* ------------------------------------------------------------------ */
/* Reliability report                                                  */
/* ------------------------------------------------------------------ */

export type ReliabilityGrade = 'resilient' | 'recovered' | 'fragile' | 'broken'

export interface ReliabilityReport {
  run_id: string
  puzzle_id: string | null
  grade: ReliabilityGrade
  score: number // 0-100
  completed: boolean
  output_valid: boolean | null
  injected_failure_handled: boolean | null // null if no scenario was enabled
  retries_used: number
  repairs_used: number // validator repair rounds, not counted in retries_used
  fallback_used: boolean
  human_review_used: boolean
  safe_stop_used: boolean
  unhandled_errors: string[]
  strengths: string[]
  weaknesses: string[]
  completion: { criterion: string; met: boolean }[]
  puzzle_solved: boolean
}

/* ------------------------------------------------------------------ */
/* Endpoint envelopes                                                  */
/* (described inline in the contract; named here for the typed client) */
/* ------------------------------------------------------------------ */

/** `GET /api/health` */
export interface HealthResponse {
  status: 'ok'
  mode: 'live' | 'mock'
  /** Active provider's label, e.g. `groq:openai/gpt-oss-120b` or `mock`. */
  provider: string
  /** Kept for back-compat; `providers.groq` says the same thing. */
  groq_configured: boolean
  /** Which live providers have a key configured. */
  providers: { groq: boolean; gemini: boolean }
}

/** One entry of `errors` / `warnings` from `POST /api/workflows/validate`. */
export interface ValidationMessage {
  code: string
  message: string
  node_id?: string
  edge_id?: string
}

/** `POST /api/workflows/validate` request body. */
export interface ValidateWorkflowRequest {
  workflow: WorkflowDef
}

/** `POST /api/workflows/validate` response. */
export interface ValidateWorkflowResponse {
  valid: boolean
  errors: ValidationMessage[]
  warnings: ValidationMessage[]
}

/** `POST /api/runs` request body. */
export interface CreateRunRequest {
  workflow: WorkflowDef
  puzzle_id?: string
  scenario_id?: string
  input?: unknown
}

/** `202` body of `POST /api/runs`, `.../review` and `.../resume-last`. */
export interface RunAccepted {
  run_id: string
}

/** `POST /api/runs/{run_id}/review` request body. */
export interface ReviewDecisionRequest {
  action: 'approve' | 'edit' | 'reject'
  edited_data?: unknown
  note?: string
}

/** Error envelope used by FastAPI for 404 / 409 responses. */
export interface ApiErrorBody {
  detail: string
}

/* ------------------------------------------------------------------ */
/* Per-block config shapes (convenience - the wire type stays           */
/* Record<string, unknown> as the contract specifies)                   */
/* ------------------------------------------------------------------ */

export interface InputConfig {
  defaults?: Record<string, unknown>
}
export interface AiModelConfig {
  prompt: string
  system?: string
  provider?: string
  temperature?: number
  expects_json?: boolean
  output_field?: string
  prompt_id?: string
}
export interface ToolConfig {
  tool: string
  params?: Record<string, unknown>
  output_field?: string
  simulate_delay_ms?: number
}
export interface RetrievalConfig {
  query?: string
  source?: string
  top_k?: number
  output_field?: string
  count_field?: string
}
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_empty'
export interface ConditionConfig {
  field: string
  operator?: ConditionOperator
  value?: unknown
}
export type TransformOperation = 'rename' | 'pick' | 'merge' | 'template'
export interface TransformConfig {
  operation?: TransformOperation
  mapping?: Record<string, unknown>
  fields?: string[]
  values?: Record<string, unknown>
  template?: string
  target?: string
}
export interface ValidatorFieldRule {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  required?: boolean
  allowed?: unknown[]
  min?: number
  max?: number
}
export type ValidatorOnFail = 'fail' | 'retry_upstream' | 'repair' | 'human_review' | 'safe_default'
export interface ValidatorConfig {
  schema: Record<string, ValidatorFieldRule>
  confidence_threshold?: number
  on_fail?: ValidatorOnFail
  safe_default?: unknown
  review_prompt?: string
  /** `repair`: how many times the upstream AI step may be asked to fix its answer (1-5). */
  max_repairs?: number
  /** `repair`: optional wording for the fix-it instruction sent back to the AI step. */
  repair_prompt?: string
}
export type ReviewAction = 'approve' | 'edit' | 'reject'
export interface HumanReviewConfig {
  prompt?: string
  allowed_actions?: ReviewAction[]
}
export interface SafeStopConfig {
  message?: string
  reason?: string
}
export interface OutputConfig {
  field?: string
}
export interface RetryConfig {
  max_attempts: number
  delay_ms?: number
}
export interface TimeoutConfig {
  timeout_ms: number
}
export type FallbackMode = 'safe_default' | 'alternate_provider'
export interface FallbackConfig {
  mode?: FallbackMode
  safe_default?: unknown
  provider?: string
}
