/**
 * In-browser fixtures backing `MockApiClient`.
 *
 * These exist so the builder is fully demonstrable before the real API lands.
 * They are shaped exactly like the contract's responses - the real backend
 * owns the canonical eight puzzles; these are a representative subset.
 */

import type { BlockType, PuzzleDetail, ReliabilityGrade, ValidationIssue } from './types'

export const MOCK_HEALTH = {
  status: 'ok',
  mode: 'mock',
  provider: 'mock-fixtures',
  groq_configured: false,
  providers: { groq: false, gemini: false },
} as const

export const MOCK_PUZZLES: PuzzleDetail[] = [
  {
    id: 'fix-the-summarizer',
    title: 'Fix the Meeting Summarizer',
    difficulty: 'beginner',
    tagline: 'The notes come back mangled - teach the workflow to check its work',
    concepts: ['validation', 'structured output'],
    order: 1,
    objective:
      'The summarizer sometimes drops the action-item owner and returns prose instead of JSON. Add a check so nothing malformed ever reaches the output.',
    description:
      'A one-step workflow asks the model for a meeting summary. It works most of the time - and quietly fails the rest. Your job is to make failure visible and recoverable.',
    sample_input: {
      transcript:
        'Ana: ship the billing fix by Friday. Ravi: I will draft the release notes. Ana: Ravi owns the notes.',
      meeting_title: 'Billing hotfix sync',
    },
    expected_output:
      'An object with `summary` (string) and `action_items` (array of { task, owner }) - every action item must name an owner.',
    available_blocks: ['input', 'ai_model', 'validator', 'transform', 'retry', 'output'],
    starter_workflow: {
      id: 'wf-fix-the-summarizer',
      name: 'Meeting summarizer (broken)',
      nodes: [
        {
          id: 'n_input',
          type: 'input',
          label: 'Meeting notes',
          config: { defaults: {} },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n_model',
          type: 'ai_model',
          label: 'Summarize',
          config: {
            prompt: 'Summarize this meeting and list the action items:\n{{transcript}}',
            expects_json: true,
            output_field: 'summary_payload',
          },
          position: { x: 0, y: 150 },
        },
        {
          id: 'n_output',
          type: 'output',
          label: 'Summary',
          config: { field: 'summary_payload' },
          position: { x: 0, y: 300 },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_input', target: 'n_model' },
        { id: 'e2', source: 'n_model', target: 'n_output' },
      ],
    },
    solution_hint: 'A Validator between the model and the output will catch the missing owner.',
    failure_scenarios: [
      {
        id: 'missing_owner',
        label: 'Missing owner',
        description: 'The model returns an action item with no owner assigned.',
      },
      {
        id: 'prose_not_json',
        label: 'Prose instead of JSON',
        description: 'The model answers in plain sentences and the JSON parse fails.',
      },
    ],
    completion_criteria: [
      'The workflow finishes without an unhandled error',
      'A validator inspects the model output before it reaches the output block',
      'Every action item in the result names an owner',
    ],
  },
  {
    id: 'approve-before-sending',
    title: 'Approve Before Sending',
    difficulty: 'beginner',
    tagline: 'Nothing goes out the door without a human nod',
    concepts: ['human review', 'approval gate'],
    order: 2,
    objective:
      'This workflow drafts a customer email and sends it immediately. Put a person in the loop before anything is sent.',
    description:
      'Autonomy is great until it emails the wrong thing to a customer. Add a review gate the run has to pause on.',
    sample_input: {
      customer: 'Nadia Okoro',
      issue: 'Charged twice for the September invoice.',
      tone: 'apologetic',
    },
    expected_output:
      'An object with `subject` and `body`, sent only after a reviewer approved (or edited) the draft.',
    available_blocks: ['input', 'ai_model', 'human_review', 'safe_stop', 'transform', 'output'],
    starter_workflow: {
      id: 'wf-approve-before-sending',
      name: 'Customer email (no gate)',
      nodes: [
        { id: 'n_input', type: 'input', label: 'Ticket', config: { defaults: {} } },
        {
          id: 'n_draft',
          type: 'ai_model',
          label: 'Draft reply',
          config: {
            prompt: 'Write an {{tone}} reply to {{customer}} about: {{issue}}',
            expects_json: true,
            output_field: 'draft',
          },
        },
        { id: 'n_send', type: 'output', label: 'Send email', config: { field: 'draft' } },
      ],
      edges: [
        { id: 'e1', source: 'n_input', target: 'n_draft' },
        { id: 'e2', source: 'n_draft', target: 'n_send' },
      ],
    },
    solution_hint: 'Human Review pauses the run and hands the draft to a person.',
    failure_scenarios: [
      {
        id: 'reviewer_rejects',
        label: 'Reviewer rejects the draft',
        description: 'The reviewer refuses the draft - the workflow must stop safely, not send anyway.',
      },
    ],
    completion_criteria: [
      'The run pauses for human review before the output block',
      'An approve decision lets the email through',
      'A reject decision stops the workflow without sending',
    ],
  },
  {
    id: 'survive-the-timeout',
    title: 'Survive the Research Timeout',
    difficulty: 'intermediate',
    tagline: 'The research API hangs. Do not hang with it.',
    concepts: ['retry', 'timeout', 'recovery'],
    order: 5,
    objective:
      'The research tool occasionally takes forever. Bound how long the workflow waits, and give it a second chance.',
    description:
      'A slow dependency should degrade a workflow, not kill it. Wrap the fragile step in guards so a hang becomes a retry instead of a dead run.',
    sample_input: {
      question: 'What changed in the EU AI Act timeline this quarter?',
      depth: 'brief',
    },
    expected_output: 'An object with `answer` (string) and `sources` (array of strings).',
    available_blocks: [
      'input',
      'tool',
      'ai_model',
      'retry',
      'timeout',
      'fallback',
      'validator',
      'output',
    ],
    starter_workflow: {
      id: 'wf-survive-the-timeout',
      name: 'Research assistant (fragile)',
      nodes: [
        {
          id: 'n_input',
          type: 'input',
          label: 'Question',
          config: { defaults: {} },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n_search',
          type: 'tool',
          label: 'Research API',
          config: { tool: 'web_research', output_field: 'findings', simulate_delay_ms: 4000 },
          position: { x: 0, y: 150 },
        },
        {
          id: 'n_answer',
          type: 'ai_model',
          label: 'Write answer',
          config: {
            prompt: 'Answer {{question}} using these findings:\n{{findings}}',
            expects_json: true,
            output_field: 'answer_payload',
          },
          position: { x: 0, y: 300 },
        },
        {
          id: 'n_output',
          type: 'output',
          label: 'Answer',
          config: { field: 'answer_payload' },
          position: { x: 0, y: 450 },
        },
      ],
      edges: [
        { id: 'e1', source: 'n_input', target: 'n_search' },
        { id: 'e2', source: 'n_search', target: 'n_answer' },
        { id: 'e3', source: 'n_answer', target: 'n_output' },
      ],
    },
    solution_hint: 'Guards sit immediately before the step they protect - Timeout, then Retry.',
    failure_scenarios: [
      {
        id: 'tool_timeout',
        label: 'Research API hangs',
        description: 'The research tool never responds on the first attempt.',
      },
      {
        id: 'tool_error',
        label: 'Research API errors',
        description: 'The tool returns a 500 on every attempt.',
      },
    ],
    tools: [
      { name: 'web_research', description: 'Searches the public web and returns short findings.' },
      { name: 'internal_wiki', description: 'Searches the company handbook. Always fast, rarely enough.' },
    ],
    completion_criteria: [
      'A Timeout guard bounds the research step',
      'A Retry guard gives the research step at least a second attempt',
      'The run completes with an answer despite the injected hang',
    ],
  },
  {
    id: 'validate-the-extractor',
    title: 'Validate the Data Extractor',
    difficulty: 'advanced',
    tagline: 'Invalid JSON in, trustworthy record out',
    concepts: ['schema validation', 'repair', 'retry'],
    order: 6,
    objective:
      'The extractor pulls structured invoice data out of raw text - and the model returns something schema-invalid roughly a third of the time. Make bad output impossible to ship.',
    description:
      'Structured output is only structured if something enforces the structure. Build a validate-and-repair loop.',
    sample_input: {
      document:
        'INVOICE #A-2291. Bill to Kestrel Labs. Total due USD 4,820.00 on 2026-10-14. Terms net 30.',
    },
    expected_output:
      'An object with `invoice_number` (string), `customer` (string), `total` (number) and `due_date` (string).',
    available_blocks: [
      'input',
      'ai_model',
      'validator',
      'condition',
      'retry',
      'transform',
      'human_review',
      'safe_stop',
      'output',
    ],
    starter_workflow: {
      id: 'wf-validate-the-extractor',
      name: 'Invoice extractor (unguarded)',
      nodes: [
        { id: 'n_input', type: 'input', label: 'Raw document', config: { defaults: {} } },
        {
          id: 'n_extract',
          type: 'ai_model',
          label: 'Extract fields',
          config: {
            prompt: 'Extract the invoice fields as JSON from:\n{{document}}',
            expects_json: true,
            output_field: 'record',
          },
        },
        {
          id: 'n_check',
          type: 'validator',
          label: 'Check schema',
          config: {
            schema: {
              invoice_number: { type: 'string', required: true },
              customer: { type: 'string', required: true },
              total: { type: 'number', required: true, min: 0 },
            },
            on_fail: 'fail',
          },
        },
        { id: 'n_output', type: 'output', label: 'Invoice record', config: { field: 'record' } },
      ],
      edges: [
        { id: 'e1', source: 'n_input', target: 'n_extract' },
        { id: 'e2', source: 'n_extract', target: 'n_check' },
        { id: 'e3', source: 'n_check', target: 'n_output' },
      ],
    },
    solution_hint:
      'The validator is there but gives up on the first failure - try a different `on_fail` and a Retry guard.',
    failure_scenarios: [
      {
        id: 'invalid_json',
        label: 'Invalid JSON',
        description: 'The model wraps its JSON in prose and the parse fails.',
      },
      {
        id: 'missing_field',
        label: 'Missing required field',
        description: 'The extracted record has no `due_date`.',
      },
      {
        id: 'wrong_type',
        label: 'Total as a string',
        description: 'The `total` comes back as "4,820.00" instead of a number.',
      },
    ],
    completion_criteria: [
      'The validator rejects a schema-invalid record instead of passing it through',
      'A failed validation triggers a repair attempt rather than ending the run',
      'The final record matches the expected schema exactly',
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Scripted runs - data for the mock engine (see mockEngine.ts)         */
/*                                                                      */
/* Runs are not hand-written event lists: the engine walks the workflow */
/* the user actually built and decorates that walk with the "incidents" */
/* of the first profile whose `match` fits. Adding a demo therefore     */
/* means adding a row here, never an if-chain.                          */
/* ------------------------------------------------------------------ */

/** What can go wrong (or right) at one step of a scripted run. */
export type IncidentKind =
  | 'retry_recovered'
  | 'fallback_rescue'
  | 'validation_repair'
  | 'review_pause'
  | 'hard_failure'

export interface Incident {
  /** Attaches to the first walked node whose type appears in this list. */
  on: BlockType[]
  kind: IncidentKind
}

export interface RunProfile {
  id: string
  /** Shown in the trace header so the demo is self-explaining. */
  label: string
  match: {
    /** Every listed block type must be somewhere in the workflow. */
    requires?: BlockType[]
    /** None of these may be in the workflow. */
    forbids?: BlockType[]
    /** Whether a failure scenario has to be armed for this profile to apply. */
    scenario?: 'armed' | 'off'
  }
  incidents: Incident[]
}

/** First match wins; the last entry is the catch-all. */
export const RUN_PROFILES: RunProfile[] = [
  {
    id: 'review_gate',
    label: 'Pauses for a human decision',
    match: { requires: ['human_review'] },
    incidents: [{ on: ['human_review'], kind: 'review_pause' }],
  },
  {
    id: 'unguarded_break',
    label: 'Injected failure, nothing to catch it',
    match: {
      scenario: 'armed',
      forbids: ['retry', 'fallback', 'timeout', 'validator', 'human_review'],
    },
    incidents: [{ on: ['tool', 'ai_model', 'retrieval'], kind: 'hard_failure' }],
  },
  {
    id: 'fallback_rescue',
    label: 'Plan B took over',
    match: { requires: ['fallback'] },
    incidents: [{ on: ['ai_model', 'tool'], kind: 'fallback_rescue' }],
  },
  {
    id: 'validation_repair',
    label: 'Caught a bad shape and repaired it',
    match: { requires: ['validator'], forbids: ['tool'] },
    incidents: [{ on: ['validator'], kind: 'validation_repair' }],
  },
  {
    id: 'retry_recovered',
    label: 'Failed once, recovered on retry',
    match: { requires: ['retry'] },
    incidents: [{ on: ['tool', 'ai_model', 'retrieval'], kind: 'retry_recovered' }],
  },
  { id: 'clean_pass', label: 'Everything worked first try', match: {}, incidents: [] },
]

/** Plausible per-step results, by puzzle then block type. */
export const STEP_OUTPUTS: Record<string, Partial<Record<BlockType, unknown>>> = {
  'fix-the-summarizer': {
    ai_model: {
      summary: 'Ana is shipping the billing fix by Friday; Ravi owns the release notes.',
      action_items: [
        { task: 'Ship the billing fix', owner: 'Ana' },
        { task: 'Draft the release notes', owner: 'Ravi' },
      ],
    },
  },
  'approve-before-sending': {
    ai_model: {
      subject: 'Sorry about the duplicate September charge',
      body: 'Hi Nadia - you were charged twice for the September invoice. The refund is on its way and should land in 3–5 days.',
    },
  },
  'survive-the-timeout': {
    tool: {
      findings: [
        'Two amendments to the phased timeline were tabled in July 2026.',
        'The high-risk obligations still start in August 2026.',
      ],
    },
    ai_model: {
      answer: 'Two amendments to the phased EU AI Act timeline were tabled in July 2026; high-risk obligations are unchanged.',
      sources: ['eur-lex/ai-act/amend-2026-07'],
    },
  },
  'validate-the-extractor': {
    ai_model: {
      invoice_number: 'A-2291',
      customer: 'Kestrel Labs',
      total: 4820,
      due_date: '2026-10-14',
    },
  },
}

/** Fallback results when a puzzle has nothing more specific to say. */
export const DEFAULT_STEP_OUTPUTS: Partial<Record<BlockType, unknown>> = {
  input: { received: true },
  ai_model: { text: 'A deterministic mock answer.' },
  tool: { result: 'ok' },
  retrieval: { documents: ['doc-1', 'doc-2', 'doc-3'], document_count: 3 },
  transform: { text: 'reshaped' },
  condition: { branch: 'true' },
  validator: { passed: true },
  output: { returned: true },
}

/** The error each incident injects, so the trace reads like a real failure. */
export const INCIDENT_ERRORS: Record<IncidentKind, { kind: string; message: string }> = {
  retry_recovered: {
    kind: 'timeout',
    message: 'The step did not respond within its time budget (5000ms).',
  },
  fallback_rescue: {
    kind: 'provider_error',
    message: 'The primary provider returned 503 twice in a row.',
  },
  validation_repair: { kind: 'schema_invalid', message: 'The result did not match the schema.' },
  review_pause: { kind: 'paused', message: 'Waiting for a human decision.' },
  hard_failure: {
    kind: 'injected_failure',
    message: 'The injected failure hit a step with no guard to catch it.',
  },
}

/** Issues reported by the repair incident's first validation pass. */
export const REPAIR_ISSUES: ValidationIssue[] = [
  {
    field: 'due_date',
    code: 'missing_required_field',
    message: 'due_date is required but was not present in the model output.',
    expected: 'string',
    actual: null,
  },
  {
    field: 'total',
    code: 'wrong_type',
    message: 'total came back as a string ("4,820.00") instead of a number.',
    expected: 'number',
    actual: '4,820.00',
  },
]

/* ------------------------------------------------------------------ */
/* Reliability scoring (mock stand-in for the backend's scorer)         */
/* ------------------------------------------------------------------ */

/** Everything the scoring tables are allowed to look at. */
export interface RunFacts {
  completed: boolean
  failed: boolean
  safeStopped: boolean
  retriesUsed: number
  fallbackUsed: boolean
  humanReviewUsed: boolean
  safeStopUsed: boolean
  validationRan: boolean
  scenarioArmed: boolean
  resumed: boolean
  blocks: Set<BlockType>
}

export interface ScoreRule {
  points: number
  when: (facts: RunFacts) => boolean
}

export const SCORE_RULES: ScoreRule[] = [
  { points: 40, when: (f) => f.completed },
  { points: 22, when: (f) => f.safeStopped },
  { points: 18, when: (f) => f.validationRan },
  { points: 14, when: (f) => f.retriesUsed > 0 || f.fallbackUsed },
  { points: 12, when: (f) => f.blocks.has('retry') || f.blocks.has('timeout') },
  { points: 10, when: (f) => f.blocks.has('fallback') || f.blocks.has('safe_stop') },
  { points: 10, when: (f) => f.humanReviewUsed },
  { points: 10, when: (f) => f.scenarioArmed && (f.completed || f.safeStopped) },
  { points: -25, when: (f) => f.failed },
]

export interface GradeRule {
  grade: ReliabilityGrade
  when: (facts: RunFacts) => boolean
}

export const GRADE_RULES: GradeRule[] = [
  {
    grade: 'resilient',
    when: (f) => f.completed && (f.retriesUsed > 0 || f.fallbackUsed || f.validationRan),
  },
  { grade: 'recovered', when: (f) => f.completed || f.safeStopped },
  { grade: 'fragile', when: (f) => f.blocks.has('retry') || f.blocks.has('validator') },
  { grade: 'broken', when: () => true },
]

export interface InsightRule {
  tone: 'strength' | 'weakness'
  when: (facts: RunFacts) => boolean
  text: string
}

export const INSIGHT_RULES: InsightRule[] = [
  { tone: 'strength', when: (f) => f.retriesUsed > 0, text: 'Recovered from a failing step on retry instead of dying.' },
  { tone: 'strength', when: (f) => f.fallbackUsed, text: 'A fallback provider took over when the primary one gave up.' },
  { tone: 'strength', when: (f) => f.validationRan, text: 'A validator inspected the data before it reached the output.' },
  { tone: 'strength', when: (f) => f.humanReviewUsed, text: 'A person got the last word before anything irreversible happened.' },
  { tone: 'strength', when: (f) => f.safeStopUsed, text: 'The workflow stopped safely rather than guessing.' },
  { tone: 'strength', when: (f) => f.resumed, text: 'Resumed from the last successful step instead of starting over.' },
  {
    tone: 'strength',
    when: (f) => f.completed && f.scenarioArmed,
    text: 'Finished cleanly even with a failure scenario armed.',
  },
  {
    tone: 'weakness',
    when: (f) => !f.validationRan,
    text: 'Nothing validates the AI output - a malformed answer would reach the output block.',
  },
  {
    tone: 'weakness',
    when: (f) => !f.blocks.has('retry') && !f.blocks.has('timeout'),
    text: 'No Retry or Timeout guard: one slow or flaky call ends the whole run.',
  },
  {
    tone: 'weakness',
    when: (f) => !f.blocks.has('fallback') && !f.blocks.has('safe_stop'),
    text: 'There is no plan B - nothing catches a step that keeps failing.',
  },
  { tone: 'weakness', when: (f) => f.failed, text: 'The run ended on an unhandled error before reaching the output.' },
]

/**
 * Completion criteria are prose. Each rule claims the criteria whose text it
 * matches; the first match decides. Anything unclaimed falls back to "did the
 * run finish".
 */
export interface CriterionRule {
  match: RegExp
  when: (facts: RunFacts) => boolean
}

export const CRITERION_RULES: CriterionRule[] = [
  { match: /human review|pause/i, when: (f) => f.humanReviewUsed },
  { match: /reject/i, when: (f) => f.safeStopUsed || f.completed },
  { match: /approve/i, when: (f) => f.completed },
  { match: /validator|validat|schema/i, when: (f) => f.validationRan },
  { match: /retry|repair attempt|second attempt/i, when: (f) => f.retriesUsed > 0 || f.blocks.has('retry') },
  { match: /timeout/i, when: (f) => f.blocks.has('timeout') },
  { match: /fallback/i, when: (f) => f.fallbackUsed || f.blocks.has('fallback') },
  { match: /resume/i, when: (f) => f.resumed },
]
