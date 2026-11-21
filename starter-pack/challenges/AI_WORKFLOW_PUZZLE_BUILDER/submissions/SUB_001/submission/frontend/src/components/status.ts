/**
 * Run-status vocabulary: one icon and one word per status.
 *
 * Kept out of `StatusBadge.tsx` so that file exports a component and nothing
 * else, and so the canvas node can reuse the mapping without importing a badge.
 */

import {
  CircleCheck,
  CircleDashed,
  CircleX,
  HeartPulse,
  Loader,
  OctagonX,
  Pause,
  RotateCcw,
  SkipForward,
  type LucideIcon,
} from 'lucide-react'
import type { StepStatus } from '@/api/types'

export const STATUS_ICONS: Record<StepStatus, LucideIcon> = {
  pending: CircleDashed,
  running: Loader,
  completed: CircleCheck,
  failed: CircleX,
  paused: Pause,
  retrying: RotateCcw,
  recovered: HeartPulse,
  safely_stopped: OctagonX,
  skipped: SkipForward,
}

/** Human wording for a status - the same words the trace uses. */
export const STATUS_LABELS: Record<StepStatus, string> = {
  pending: 'waiting',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  paused: 'waiting for you',
  retrying: 'retrying',
  recovered: 'recovered',
  safely_stopped: 'stopped safely',
  skipped: 'skipped',
}
