import { lookupTable } from "@/lib/lookup"
import type { BadgeVariant } from "@/components/shared/types"
import type { Confidence, Priority } from "@/components/shared/types"
import type { GapCriticality } from "@/api/types"

/** The five meanings every state in the app maps onto. */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

/**
 * One mapping for every state word the API returns, whatever field it came from.
 * Ranked scales (priority, confidence) have their own maps below, because "high" means
 * something good in one and something alarming in the other.
 */
const TONES = lookupTable<string, StatusTone>({
  done: "success",
  approved: "success",
  passed: "success",
  verified: "success",
  fresh: "success",
  confirmed: "success",
  customer_stated: "success",
  customer: "success",
  stale: "warning",
  review_required: "warning",
  pending: "warning",
  warning: "warning",
  needs_validation: "warning",
  assumed: "warning",
  modified: "warning",
  human_decision: "warning",
  regenerate: "warning",
  blocked: "danger",
  failed: "danger",
  critical: "danger",
  rejected: "danger",
  error: "danger",
  unverified: "danger",
  ready: "info",
  in_progress: "info",
  proposed: "info",
  analyzed: "info",
  ai_inferred: "info",
  inferred: "info",
  recommended: "info",
  ai: "info",
  recalculate: "info",
  not_started: "neutral",
  empty: "neutral",
  dismissed: "neutral",
  not_applicable: "neutral",
  deterministic: "neutral",
  relink: "neutral",
})

export function statusTone(value: string): StatusTone {
  return TONES.get(value) ?? "neutral"
}

const PRIORITY_TONES = lookupTable<Priority, StatusTone>({
  must: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
})

export function priorityTone(priority: Priority): StatusTone {
  return PRIORITY_TONES.get(priority) ?? "neutral"
}

const CONFIDENCE_TONES = lookupTable<Confidence, StatusTone>({
  high: "success",
  medium: "warning",
  low: "danger",
})

export function confidenceTone(confidence: Confidence): StatusTone {
  return CONFIDENCE_TONES.get(confidence) ?? "neutral"
}

const BADGE_VARIANTS = lookupTable<StatusTone, BadgeVariant>({
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "outline",
})

export function toneBadgeVariant(tone: StatusTone): BadgeVariant {
  return BADGE_VARIANTS.get(tone) ?? "outline"
}

const TEXT_CLASSES = lookupTable<StatusTone, string>({
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
})

/** For icons and dots, where a badge would be too heavy. */
export function toneTextClass(tone: StatusTone): string {
  return TEXT_CLASSES.get(tone) ?? "text-muted-foreground"
}

const MARKER_CLASSES = lookupTable<StatusTone, string>({
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-info/40 bg-info/10 text-info",
  neutral: "border-border text-muted-foreground",
})

/** Outline plus soft fill, for the step-rail markers. */
export function toneMarkerClass(tone: StatusTone): string {
  return MARKER_CLASSES.get(tone) ?? "border-border text-muted-foreground"
}

const CRITICALITY_TONES = lookupTable<GapCriticality, StatusTone>({
  high: "danger",
  medium: "warning",
  low: "neutral",
})

/** How loudly a missing piece of information should read. */
export function criticalityTone(criticality: GapCriticality): StatusTone {
  return CRITICALITY_TONES.get(criticality) ?? "neutral"
}
