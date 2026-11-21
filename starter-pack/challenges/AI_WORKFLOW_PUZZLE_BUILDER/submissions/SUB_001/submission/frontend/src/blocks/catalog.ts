/**
 * Block catalog - the frontend's single source of truth for block metadata.
 *
 * It drives the palette, the node renderer, the inspector's config form and
 * the canvas connection rules. Nothing about a block should be hardcoded
 * anywhere else: to change how a block looks or configures, change it here.
 *
 * The `fields` descriptors mirror the backend block config models
 * (backend/app/blocks) exactly, including defaults.
 */

import {
  Brain,
  Flag,
  Inbox,
  Library,
  LifeBuoy,
  OctagonX,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Split,
  Timer,
  UserCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { BlockType } from '../api/types'

export type BlockCategory = 'Core' | 'Reliability' | 'Human Control'

/** Input widget kinds the config form knows how to render. */
export type FieldKind = 'text' | 'number' | 'select' | 'json' | 'checkbox'

export interface SelectOption {
  value: string
  label: string
}

export interface FieldDescriptor {
  /** Config key, verbatim from the contract. */
  name: string
  label: string
  kind: FieldKind
  /** Short lowercase key for the canvas node's config rows; falls back to `label`. */
  summaryLabel?: string
  /** `number` only - unit appended after the value on the node card ("4000 ms"). */
  unit?: string
  /** `text` only - render a textarea. */
  multiline?: boolean
  /** `select` only. */
  options?: SelectOption[]
  /** `select` only - pick several values; serialised as an array. */
  multiple?: boolean
  /** `number` only. */
  min?: number
  max?: number
  /** Contract default, applied when a block is dropped on the canvas. */
  default?: unknown
  /** Friendly one-liner under the input. */
  help?: string
  /** Flagged by "Check workflow" when empty. */
  required?: boolean
  placeholder?: string
}

export interface BlockMeta {
  type: BlockType
  displayName: string
  category: BlockCategory
  /** Semantic lucide icon - the app ships no emoji. */
  Icon: LucideIcon
  /** One-line friendly description, shown in the palette. */
  description: string
  fields: FieldDescriptor[]
  /**
   * Config keys the canvas node summarises, most meaningful first. The card
   * renders the first three that actually carry a value, so a list may be
   * longer than three when a block configures itself several different ways.
   */
  summaryFields: string[]
  /** Guards wrap the step immediately after them. */
  isGuard: boolean
  /** Condition blocks expose `true` / `false` source handles. */
  branching: boolean
  allowsIncoming: boolean
  allowsOutgoing: boolean
}

export const CATEGORY_ORDER: BlockCategory[] = ['Core', 'Reliability', 'Human Control']

/**
 * Category tints live in `index.css` as `--cat-*` tokens and are applied by the
 * `.cat-tint` utility keyed on `data-category`, so nothing here carries a colour.
 */
export const CATEGORY_META: Record<BlockCategory, { blurb: string }> = {
  Core: { blurb: 'The steps that do the work' },
  Reliability: { blurb: 'Guards that keep it standing up' },
  'Human Control': { blurb: 'Where a person gets the last word' },
}

export const CATALOG: Record<BlockType, BlockMeta> = {
  input: {
    type: 'input',
    displayName: 'Input',
    category: 'Core',
    Icon: Inbox,
    description: 'Input - where the workflow gets its starting data',
    isGuard: false,
    branching: false,
    allowsIncoming: false,
    allowsOutgoing: true,
    summaryFields: ['defaults'],
    fields: [
      {
        name: 'defaults',
        label: 'Default values',
        summaryLabel: 'defaults',
        kind: 'json',
        default: {},
        help: 'Merged under the run input, so missing fields still have something sensible.',
      },
    ],
  },

  ai_model: {
    type: 'ai_model',
    displayName: 'AI Model',
    category: 'Core',
    Icon: Brain,
    description: 'AI Model - ask a language model to do the thinking',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['prompt', 'output_field', 'expects_json', 'prompt_id'],
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        summaryLabel: 'prompt',
        kind: 'text',
        multiline: true,
        required: true,
        placeholder: 'Summarize this meeting:\n{{transcript}}',
        help: 'Use {{field}} to drop values from the workflow state into the prompt.',
      },
      {
        name: 'system',
        label: 'System prompt',
        kind: 'text',
        multiline: true,
        help: 'Optional standing instructions for the model.',
      },
      { name: 'provider', label: 'Provider', kind: 'text', help: 'Leave empty to use the default provider.' },
      {
        name: 'temperature',
        label: 'Temperature',
        kind: 'number',
        min: 0,
        max: 2,
        help: 'Higher is more creative, lower is more predictable.',
      },
      {
        name: 'expects_json',
        label: 'Expects JSON',
        summaryLabel: 'json',
        kind: 'checkbox',
        default: false,
        help: 'Parse the answer as JSON - a parse failure becomes a step failure.',
      },
      {
        name: 'output_field',
        label: 'Output field',
        summaryLabel: 'output',
        kind: 'text',
        help: 'Name to store the answer under in the workflow state.',
      },
      {
        name: 'prompt_id',
        label: 'Prompt ID',
        summaryLabel: 'prompt id',
        kind: 'text',
        help: 'Reference a stored prompt instead of inlining one.',
      },
    ],
  },

  tool: {
    type: 'tool',
    displayName: 'Tool',
    category: 'Core',
    Icon: Wrench,
    description: 'Tool - call an external API or service',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['tool', 'output_field', 'simulate_delay_ms', 'params'],
    fields: [
      {
        name: 'tool',
        label: 'Tool name',
        summaryLabel: 'tool',
        kind: 'text',
        required: true,
        placeholder: 'web_research',
        help: 'Identifier of the simulated tool to call.',
      },
      {
        name: 'params',
        label: 'Parameters',
        summaryLabel: 'params',
        kind: 'json',
        default: {},
        help: 'Arguments handed to the tool.',
      },
      {
        name: 'output_field',
        label: 'Output field',
        summaryLabel: 'output',
        kind: 'text',
        help: 'Where to store what the tool returns.',
      },
      {
        name: 'simulate_delay_ms',
        label: 'Simulated delay (ms)',
        summaryLabel: 'delay',
        unit: 'ms',
        kind: 'number',
        min: 0,
        help: 'Pretend the tool is slow - handy for practising timeouts.',
      },
    ],
  },

  retrieval: {
    type: 'retrieval',
    displayName: 'Retrieval',
    category: 'Core',
    Icon: Library,
    description: 'Retrieval - look up supporting documents',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['source', 'top_k', 'output_field', 'query'],
    fields: [
      {
        name: 'query',
        label: 'Query',
        summaryLabel: 'query',
        kind: 'text',
        multiline: true,
        help: 'Supports {{field}} placeholders.',
      },
      { name: 'source', label: 'Source', summaryLabel: 'source', kind: 'text', help: 'Which knowledge base to search.' },
      { name: 'top_k', label: 'How many documents', summaryLabel: 'top k', kind: 'number', min: 1, default: 3 },
      {
        name: 'output_field',
        label: 'Documents field',
        summaryLabel: 'documents',
        kind: 'text',
        default: 'documents',
      },
      {
        name: 'count_field',
        label: 'Count field',
        summaryLabel: 'count',
        kind: 'text',
        default: 'document_count',
        help: 'Check this with a Condition to catch an empty retrieval.',
      },
    ],
  },

  condition: {
    type: 'condition',
    displayName: 'Condition',
    category: 'Core',
    Icon: Split,
    description: 'Condition - send the workflow down one of two paths',
    isGuard: false,
    branching: true,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['field', 'operator', 'value'],
    fields: [
      {
        name: 'field',
        label: 'Field to check',
        summaryLabel: 'field',
        kind: 'text',
        required: true,
        placeholder: 'document_count',
      },
      {
        name: 'operator',
        label: 'Test',
        summaryLabel: 'test',
        kind: 'select',
        default: 'exists',
        options: [
          { value: 'eq', label: 'equals' },
          { value: 'ne', label: 'does not equal' },
          { value: 'gt', label: 'is greater than' },
          { value: 'lt', label: 'is less than' },
          { value: 'gte', label: 'is at least' },
          { value: 'lte', label: 'is at most' },
          { value: 'exists', label: 'exists' },
          { value: 'not_empty', label: 'is not empty' },
        ],
      },
      {
        name: 'value',
        label: 'Compare against',
        summaryLabel: 'value',
        kind: 'json',
        help: 'Not needed for "exists" or "is not empty".',
      },
    ],
  },

  transform: {
    type: 'transform',
    displayName: 'Transform',
    category: 'Core',
    Icon: Shuffle,
    description: 'Transform - reshape the data between steps',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['operation', 'values', 'mapping', 'fields', 'template', 'target'],
    fields: [
      {
        name: 'operation',
        label: 'Operation',
        summaryLabel: 'operation',
        kind: 'select',
        default: 'merge',
        options: [
          { value: 'rename', label: 'rename - move fields to new names' },
          { value: 'pick', label: 'pick - keep only some fields' },
          { value: 'merge', label: 'merge - add fixed values' },
          { value: 'template', label: 'template - build a string' },
        ],
      },
      { name: 'mapping', label: 'Mapping', summaryLabel: 'renames', kind: 'json', help: 'For rename: { "old": "new" }.' },
      { name: 'fields', label: 'Fields', summaryLabel: 'keeps', kind: 'json', help: 'For pick: ["keep_me", "and_me"].' },
      { name: 'values', label: 'Values', summaryLabel: 'adds', kind: 'json', help: 'For merge: fixed values to add.' },
      {
        name: 'template',
        label: 'Template',
        summaryLabel: 'template',
        kind: 'text',
        multiline: true,
        help: 'For template: text with {{field}} placeholders.',
      },
      {
        name: 'target',
        label: 'Target field',
        summaryLabel: 'target',
        kind: 'text',
        default: 'text',
        help: 'Where the template result lands.',
      },
    ],
  },

  output: {
    type: 'output',
    displayName: 'Output',
    category: 'Core',
    Icon: Flag,
    description: 'Output - the finish line, and what the workflow returns',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: false,
    summaryFields: ['field'],
    fields: [
      {
        name: 'field',
        label: 'Field to return',
        summaryLabel: 'returns',
        kind: 'text',
        help: 'Leave empty to return the whole workflow state.',
      },
    ],
  },

  validator: {
    type: 'validator',
    displayName: 'Validator',
    category: 'Reliability',
    Icon: ShieldCheck,
    description: 'Validator - check the data is the right shape before it moves on',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['schema', 'on_fail', 'confidence_threshold'],
    fields: [
      {
        name: 'schema',
        label: 'Schema',
        summaryLabel: 'checks',
        kind: 'json',
        required: true,
        default: {},
        help: 'Per field: { "type": "string", "required": true, "allowed": [], "min": 0, "max": 10 }.',
      },
      {
        name: 'confidence_threshold',
        label: 'Confidence threshold',
        summaryLabel: 'min confidence',
        kind: 'number',
        min: 0,
        max: 1,
        help: 'Reject answers the model is not confident enough about.',
      },
      {
        name: 'on_fail',
        label: 'When validation fails',
        summaryLabel: 'on fail',
        kind: 'select',
        default: 'fail',
        options: [
          { value: 'fail', label: 'fail - stop the run' },
          { value: 'retry_upstream', label: 'retry upstream - ask the previous step again' },
          { value: 'repair', label: 'repair - send the problems back to the AI step to fix' },
          { value: 'human_review', label: 'human review - hand it to a person' },
          { value: 'safe_default', label: 'safe default - substitute a known-good value' },
        ],
      },
      { name: 'safe_default', label: 'Safe default', kind: 'json', help: 'Used when "safe default" is chosen above.' },
      {
        name: 'review_prompt',
        label: 'Review prompt',
        kind: 'text',
        multiline: true,
        help: 'What to ask the reviewer when "human review" is chosen above.',
      },
      {
        name: 'max_repairs',
        label: 'Max repairs',
        kind: 'number',
        min: 1,
        max: 5,
        default: 1,
        help: 'How many times the AI step may be asked to fix its answer when "repair" is chosen above.',
      },
      {
        name: 'repair_prompt',
        label: 'Repair prompt',
        kind: 'text',
        multiline: true,
        help: 'Optional wording for the fix-it instruction sent back to the AI step when "repair" is chosen above.',
      },
    ],
  },

  retry: {
    type: 'retry',
    displayName: 'Retry',
    category: 'Reliability',
    Icon: RotateCcw,
    description: 'Retry - try again when a step fails',
    isGuard: true,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['max_attempts'],
    fields: [
      {
        name: 'max_attempts',
        label: 'Max attempts',
        summaryLabel: 'max attempts',
        kind: 'number',
        min: 1,
        max: 10,
        default: 2,
        required: true,
        help: 'Counting the first try. 2 means one retry.',
      },
      {
        name: 'delay_ms',
        label: 'Delay between attempts (ms)',
        summaryLabel: 'delay',
        unit: 'ms',
        kind: 'number',
        min: 0,
        default: 0,
      },
    ],
  },

  timeout: {
    type: 'timeout',
    displayName: 'Timeout',
    category: 'Reliability',
    Icon: Timer,
    description: 'Timeout - give up waiting after a while',
    isGuard: true,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['timeout_ms'],
    fields: [
      {
        name: 'timeout_ms',
        label: 'Timeout (ms)',
        summaryLabel: 'timeout',
        unit: 'ms',
        kind: 'number',
        min: 1,
        default: 5000,
        required: true,
        help: 'How long the protected step may take before it counts as failed.',
      },
    ],
  },

  fallback: {
    type: 'fallback',
    displayName: 'Fallback',
    category: 'Reliability',
    Icon: LifeBuoy,
    description: 'Fallback - a plan B when the step keeps failing',
    isGuard: true,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['mode', 'provider', 'safe_default'],
    fields: [
      {
        name: 'mode',
        label: 'Fallback mode',
        summaryLabel: 'mode',
        kind: 'select',
        default: 'safe_default',
        options: [
          { value: 'safe_default', label: 'safe default - return a known-good value' },
          { value: 'alternate_provider', label: 'alternate provider - try a different model' },
        ],
      },
      {
        name: 'safe_default',
        label: 'Safe default',
        summaryLabel: 'safe default',
        kind: 'json',
        help: 'Returned when the protected step gives up.',
      },
      {
        name: 'provider',
        label: 'Alternate provider',
        summaryLabel: 'provider',
        kind: 'text',
        help: 'Used with "alternate provider".',
      },
    ],
  },

  human_review: {
    type: 'human_review',
    displayName: 'Human Review',
    category: 'Human Control',
    Icon: UserCheck,
    description: 'Human Review - pause and let a person approve, edit or reject',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: true,
    summaryFields: ['prompt', 'allowed_actions'],
    fields: [
      {
        name: 'prompt',
        label: 'Question for the reviewer',
        summaryLabel: 'asks',
        kind: 'text',
        multiline: true,
        placeholder: 'Send this email to the customer?',
      },
      {
        name: 'allowed_actions',
        label: 'Allowed decisions',
        summaryLabel: 'decisions',
        kind: 'select',
        multiple: true,
        default: ['approve', 'edit', 'reject'],
        options: [
          { value: 'approve', label: 'Approve' },
          { value: 'edit', label: 'Edit' },
          { value: 'reject', label: 'Reject' },
        ],
      },
    ],
  },

  safe_stop: {
    type: 'safe_stop',
    displayName: 'Safe Stop',
    category: 'Human Control',
    Icon: OctagonX,
    description: 'Safe Stop - end the run on purpose instead of guessing',
    isGuard: false,
    branching: false,
    allowsIncoming: true,
    allowsOutgoing: false,
    summaryFields: ['reason', 'message'],
    fields: [
      {
        name: 'message',
        label: 'Message',
        summaryLabel: 'message',
        kind: 'text',
        multiline: true,
        placeholder: 'I could not find enough evidence to answer this.',
      },
      {
        name: 'reason',
        label: 'Reason code',
        summaryLabel: 'reason',
        kind: 'text',
        help: 'Short machine-friendly label, e.g. "no_evidence".',
      },
    ],
  },
}

export const ALL_BLOCK_TYPES: BlockType[] = Object.keys(CATALOG) as BlockType[]

export function blocksByCategory(types: BlockType[] = ALL_BLOCK_TYPES): [BlockCategory, BlockMeta[]][] {
  return CATEGORY_ORDER.map((category): [BlockCategory, BlockMeta[]] => [
    category,
    types.map((type) => CATALOG[type]).filter((meta) => meta.category === category), // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: CATALOG is Record<BlockType, BlockMeta> and type is that union, not user input
  ]).filter(([, metas]) => metas.length > 0)
}

/** Config object for a freshly-dropped block, seeded with contract defaults. */
export function defaultConfig(type: BlockType): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const field of CATALOG[type].fields) { // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
    if (field.default !== undefined) config[field.name] = structuredClone(field.default) // nosemgrep: gitlab.eslint.detect-object-injection -- field.name is a literal from this module's own descriptors, not user input
  }
  return config
}

/* ------------------------------------------------------------------ */
/* Node card summary                                                   */
/* ------------------------------------------------------------------ */

/** One `key: value` line on a canvas node. */
export interface SummaryRow {
  key: string
  value: string
}

/** Rows a node card shows at most, before the card stops reading at a glance. */
const MAX_SUMMARY_ROWS = 3
const MAX_VALUE_CHARS = 30

const clip = (text: string): string =>
  text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1).trimEnd()}…` : text

/** `'human review - hand it to a person'` → `'human review'`. */
const optionLabel = (field: FieldDescriptor, value: string): string => {
  const option = field.options?.find((candidate) => candidate.value === value)
  return (option?.label ?? value).split('-')[0].trim()
}

/**
 * A config value as one short line, or `null` when it carries nothing worth
 * the row (empty string, empty object/array, an unticked checkbox).
 */
function summaryValue(field: FieldDescriptor, value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 'yes' : null
  if (typeof value === 'number') return field.unit ? `${value} ${field.unit}` : String(value)
  if (typeof value === 'string') {
    const flat = value.replace(/\s+/g, ' ').trim()
    if (!flat) return null
    if (field.kind === 'select') return clip(optionLabel(field, flat))
    return field.multiline ? `“${clip(flat)}”` : clip(flat)
  }
  if (Array.isArray(value)) {
    const parts = value.map((entry) => (field.kind === 'select' ? optionLabel(field, String(entry)) : String(entry)))
    return parts.length > 0 ? clip(parts.join(', ')) : null
  }
  if (typeof value === 'object') {
    // Objects read best as their keys - "minutes.summary, minutes.decisions…".
    const keys = Object.keys(value as object)
    return keys.length > 0 ? clip(keys.join(', ')) : null
  }
  return null
}

/**
 * The key/value lines shown on a node's body: the block's `summaryFields`, in
 * order, keeping the first three that actually carry a value. An empty result
 * means the block is still at its defaults - the card falls back to `blockBlurb`.
 */
export function configRows(type: BlockType, config: Record<string, unknown>): SummaryRow[] {
  const meta = CATALOG[type] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
  const byName = new Map(meta.fields.map((field) => [field.name, field]))
  const rows: SummaryRow[] = []
  for (const name of meta.summaryFields) {
    if (rows.length >= MAX_SUMMARY_ROWS) break
    const field = byName.get(name)
    if (!field) continue
    const value = summaryValue(field, config[name]) // nosemgrep: gitlab.eslint.detect-object-injection -- name is a literal from this module's own `summaryFields`, not user input
    if (value !== null) rows.push({ key: field.summaryLabel ?? field.label.toLowerCase(), value })
  }
  return rows
}

/** The description without the leading block name, which the card already shows. */
export function blockBlurb(type: BlockType): string {
  const meta = CATALOG[type] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
  const prefix = `${meta.displayName} - `
  return meta.description.startsWith(prefix) ? meta.description.slice(prefix.length) : meta.description
}
