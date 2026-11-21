/**
 * How each trace event reads in the drawer.
 *
 * The whole timeline is rendered from this one table - icon, tone and a
 * friendly sentence per event type - so the judge can follow the journey
 * without knowing anything about the engine's vocabulary.
 */

import {
  CircleCheck,
  CircleDot,
  CircleX,
  Flag,
  Gavel,
  Hammer,
  HeartPulse,
  LifeBuoy,
  OctagonX,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  ScanSearch,
  SkipForward,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import type { EventType, TraceEvent } from '../api/types'
import { readAttempt, readError, readNumber, readReview, readString, readValidation } from './payload'

export type TraceTone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent'

/** Tone → Tailwind colour utilities. Every value resolves to a token. */
export const TONE_TEXT: Record<TraceTone, string> = {
  neutral: 'text-muted-foreground',
  good: 'text-status-completed',
  bad: 'text-status-failed',
  warn: 'text-status-paused',
  accent: 'text-primary',
}

export const TONE_BG: Record<TraceTone, string> = {
  neutral: 'bg-muted-foreground/10',
  good: 'bg-status-completed/10',
  bad: 'bg-status-failed/10',
  warn: 'bg-status-paused/10',
  accent: 'bg-primary/10',
}

export interface TraceDescriptor {
  Icon: LucideIcon
  tone: TraceTone
  title: (event: TraceEvent) => string
  detail: (event: TraceEvent) => string | null
}

const nameOf = (event: TraceEvent) => event.node_label ?? 'This step'
const none = () => null

/** The messages of the `issues[]` list a step_repairing event carries. */
function readIssues(payload: Record<string, unknown>): string[] {
  const issues = payload.issues
  if (!Array.isArray(issues)) return []
  return issues
    .map((issue) => (issue && typeof issue === 'object' && 'message' in issue ? String((issue as { message: unknown }).message) : ''))
    .filter((message) => message.length > 0)
}

export const TRACE_DESCRIPTORS: Record<EventType, TraceDescriptor> = {
  run_started: {
    Icon: Rocket,
    tone: 'accent',
    title: () => 'Run started',
    detail: (event) => {
      const scenario = readString(event.payload, 'scenario_id')
      return scenario ? `Failure scenario armed: ${scenario}` : 'No failure scenario armed'
    },
  },
  step_started: {
    Icon: Play,
    tone: 'neutral',
    title: (event) => `${nameOf(event)} started`,
    detail: none,
  },
  step_completed: {
    Icon: CircleCheck,
    tone: 'good',
    title: (event) => {
      const guard = readString(event.payload, 'guard')
      const protects = readString(event.payload, 'protects')
      if (guard) return `${nameOf(event)} is guarding ${protects ?? 'the next step'}`
      return `${nameOf(event)} finished`
    },
    detail: none,
  },
  step_failed: {
    Icon: CircleX,
    tone: 'bad',
    title: (event) => `${nameOf(event)} failed`,
    detail: (event) => readError(event.payload)?.message ?? null,
  },
  step_retrying: {
    Icon: RotateCcw,
    tone: 'warn',
    title: (event) => {
      const attempt = readAttempt(event.payload)
      const max = readNumber(event.payload, 'max_attempts')
      if (attempt && max) return `Retry attempt ${attempt} of ${max}`
      if (attempt) return `Retry attempt ${attempt}`
      return 'Trying again'
    },
    detail: (event) => {
      const action = readString(event.payload, 'recovery_action')
      return action ? `Recovery action: ${action}` : `Giving ${nameOf(event)} another go`
    },
  },
  step_repairing: {
    Icon: Hammer,
    tone: 'warn',
    title: (event) => {
      const upstream = readString(event.payload, 'upstream_node_label') ?? 'the previous step'
      const round = readNumber(event.payload, 'round')
      const max = readNumber(event.payload, 'max_rounds')
      const rounds = round && max ? ` (repair ${round} of ${max})` : ''
      return `Sending the answer back to ${upstream} to fix${rounds}`
    },
    detail: (event) => {
      const issues = readIssues(event.payload)
      return issues.length > 0 ? issues.join(' · ') : 'The problems found were spelled out to the model'
    },
  },
  step_recovered: {
    Icon: HeartPulse,
    tone: 'good',
    title: (event) => {
      const attempt = readAttempt(event.payload)
      return attempt ? `${nameOf(event)} recovered on attempt ${attempt}` : `${nameOf(event)} recovered`
    },
    detail: (event) => {
      const action = readString(event.payload, 'recovery_action')
      if (action === 'fallback') return 'The fallback answer was accepted'
      if (action === 'repair') return 'The corrected answer passed validation'
      return null
    },
  },
  step_skipped: {
    Icon: SkipForward,
    tone: 'neutral',
    title: (event) => `Skipped ${nameOf(event)}`,
    detail: (event) => readString(event.payload, 'reason') ?? 'Already done in the earlier run',
  },
  validation_result: {
    Icon: ScanSearch,
    tone: 'neutral',
    title: (event) => {
      const validation = readValidation(event.payload)
      if (!validation) return 'Validation ran'
      if (validation.passed) return 'Validation passed'
      const count = validation.issues.length
      return `Validation found ${count} problem${count === 1 ? '' : 's'}`
    },
    detail: (event) => {
      const validation = readValidation(event.payload)
      if (!validation || validation.passed) return null
      return validation.issues.map((issue) => issue.message).join(' · ')
    },
  },
  review_requested: {
    Icon: UserCheck,
    tone: 'warn',
    title: () => 'Waiting for your decision',
    detail: (event) => readReview(event.payload)?.prompt ?? null,
  },
  review_decision: {
    Icon: Gavel,
    tone: 'accent',
    title: (event) => {
      const action = readReview(event.payload)?.action
      const verb: Record<string, string> = {
        approve: 'You approved this step',
        edit: 'You edited the data and approved it',
        reject: 'You rejected this step',
      }
      return (action && verb[action]) ?? 'Your decision was recorded'
    },
    detail: (event) => readReview(event.payload)?.note ?? null,
  },
  fallback_used: {
    Icon: LifeBuoy,
    tone: 'warn',
    title: (event) => {
      const fallback = event.payload.fallback
      const provider =
        fallback && typeof fallback === 'object' && 'provider' in fallback
          ? String((fallback as { provider: unknown }).provider)
          : null
      return provider
        ? `Fallback rescued this step via ${provider}`
        : `Fallback rescued ${nameOf(event)}`
    },
    detail: () => 'Plan B took over so the run could keep going',
  },
  run_paused: {
    Icon: Pause,
    tone: 'warn',
    title: () => 'Run paused for human review',
    detail: () => 'Nothing else happens until you decide',
  },
  run_resumed: {
    Icon: Play,
    tone: 'accent',
    title: () => 'Run resumed',
    detail: none,
  },
  run_completed: {
    Icon: Flag,
    tone: 'good',
    title: () => 'Run completed',
    detail: () => 'Every step reached the finish line',
  },
  run_failed: {
    Icon: TriangleAlert,
    tone: 'bad',
    title: () => 'Run failed',
    detail: (event) => readError(event.payload)?.message ?? 'A step failed with nothing to catch it',
  },
  run_safe_stopped: {
    Icon: OctagonX,
    tone: 'warn',
    title: (event) => {
      const message = readString(event.payload, 'message')
      return message ? `Stopped safely: ${message}` : 'Stopped safely'
    },
    detail: () => 'A deliberate stop beats a wrong answer',
  },
}

const FALLBACK_DESCRIPTOR: TraceDescriptor = {
  Icon: CircleDot,
  tone: 'neutral',
  title: (event) => event.event.replace(/_/g, ' '),
  detail: none,
}

export function describe(event: TraceEvent): TraceDescriptor {
  return TRACE_DESCRIPTORS[event.event] ?? FALLBACK_DESCRIPTOR // nosemgrep: gitlab.eslint.detect-object-injection -- read-only lookup in a static descriptor table; any key that is not one of ours falls back to FALLBACK_DESCRIPTOR
}

export function formatClock(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
