/**
 * Typed readers for `TraceEvent.payload`.
 *
 * The contract types the payload as `Record<string, unknown>` - deliberately
 * open, because every block puts something different in it. These helpers are
 * the only place that narrows it, so no component needs a cast.
 */

import type { RunError, ValidationIssue } from '../api/types'

export function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key] // nosemgrep: gitlab.eslint.detect-object-injection -- read-only lookup on a trace payload; every caller passes a literal key and the value is type-narrowed below
  return typeof value === 'string' ? value : null
}

export function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key] // nosemgrep: gitlab.eslint.detect-object-injection -- read-only lookup on a trace payload; every caller passes a literal key and the value is type-narrowed below
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function readRecord(payload: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = payload[key] // nosemgrep: gitlab.eslint.detect-object-injection -- read-only lookup on a trace payload; every caller passes a literal key and the value is type-narrowed below
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function readError(payload: Record<string, unknown>): RunError | null {
  const error = readRecord(payload, 'error')
  if (!error) return null
  return {
    kind: typeof error.kind === 'string' ? error.kind : 'error',
    message: typeof error.message === 'string' ? error.message : 'Something went wrong.',
    ...(readRecord(error, 'detail') ? { detail: readRecord(error, 'detail') as object } : {}),
  }
}

export interface ValidationSummary {
  passed: boolean
  issues: ValidationIssue[]
}

export function readValidation(payload: Record<string, unknown>): ValidationSummary | null {
  // `step_completed` nests the result under `validation`; the dedicated
  // `validation_result` event spreads `passed`/`issues` at the top level.
  const validation = readRecord(payload, 'validation') ?? (payload.passed === undefined ? null : payload)
  if (!validation) return null
  const issues = Array.isArray(validation.issues) ? validation.issues : []
  return {
    passed: validation.passed === true,
    issues: issues.filter((issue): issue is ValidationIssue => issue !== null && typeof issue === 'object'),
  }
}

export interface ReviewSummary {
  action: string | null
  prompt: string | null
  note: string | null
  allowedActions: string[]
  editedData: unknown
}

export function readReview(payload: Record<string, unknown>): ReviewSummary | null {
  const review = readRecord(payload, 'review')
  if (!review) return null
  return {
    action: readString(review, 'action'),
    prompt: readString(review, 'prompt'),
    note: readString(review, 'note'),
    allowedActions: Array.isArray(review.allowed_actions) ? review.allowed_actions.map(String) : [],
    editedData: review.edited_data,
  }
}

export interface ProviderMeta {
  providerUsed: string | null
  mocked: boolean
  confidence: number | null
}

/**
 * `provider_used` / `mocked` / `confidence` from an ai_model step.
 *
 * The backend pins these (see the TraceEvent note in api/types.ts) to the TOP
 * level of the terminal step event's payload - not under `payload.meta`. A
 * `meta` envelope and a provider that nests them under the output are still
 * tolerated, because both shapes have existed in fixtures.
 */
export function readProviderMeta(payload: Record<string, unknown>): ProviderMeta | null {
  const output = readRecord(payload, 'output')
  const source =
    payload.provider_used !== undefined || payload.mocked !== undefined
      ? payload
      : (readRecord(payload, 'meta') ?? (output ? readRecord(output, 'meta') : null))
  if (!source) return null
  const providerUsed = readString(source, 'provider_used')
  if (providerUsed === null && source.mocked === undefined) return null
  return {
    providerUsed,
    mocked: source.mocked === true,
    confidence: readNumber(source, 'confidence'),
  }
}

/** Attempt number, wherever the block chose to record it. */
export function readAttempt(payload: Record<string, unknown>): number | null {
  return readNumber(payload, 'attempt')
}

/** Pretty-print any value for display in the inspector, review modal or a copy. */
export function stringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}
