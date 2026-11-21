/**
 * The collapsed timeline: one row per step instead of "started" + "finished".
 *
 * The engine records two events for every step - `step_started` when it begins
 * and a terminal event (`step_completed`, `step_failed`, `step_recovered`,
 * `review_requested`) when it ends. Both are kept, because the scorer and the
 * resume feature read them, but showing both makes a finished run read as a
 * doubled list. So the drawer shows every event except `step_started`, plus the
 * `step_started` of any step that is still running (no terminal event yet), so
 * a live run still shows its current step.
 */

import type { EventType, TraceEvent } from '@/api/types'

const TERMINAL: ReadonlySet<EventType> = new Set<EventType>([
  'step_completed',
  'step_failed',
  'step_recovered',
  'review_requested',
])

/** Seqs of `step_started` events whose step has not finished yet. */
export function openStarts(events: TraceEvent[]): Set<number> {
  const openByNode = new Map<string, number>()
  for (const event of events) {
    if (!event.node_id) continue
    if (event.event === 'step_started') {
      openByNode.set(event.node_id, event.seq)
    } else if (TERMINAL.has(event.event)) {
      openByNode.delete(event.node_id)
    }
  }
  return new Set(openByNode.values())
}

/** Every event except the `step_started` of steps that have since finished. */
export function collapseTimeline(events: TraceEvent[]): TraceEvent[] {
  const open = openStarts(events)
  return events.filter((event) => event.event !== 'step_started' || open.has(event.seq))
}

/**
 * Keep a selection meaningful when its row is hidden by the collapse: a
 * `step_started` that has finished maps to the step's terminal event.
 */
export function resolveSelection(
  events: TraceEvent[],
  shown: TraceEvent[],
  selectedSeq: number | null,
): TraceEvent | null {
  if (selectedSeq === null) return null
  const direct = shown.find((event) => event.seq === selectedSeq)
  if (direct) return direct
  const hidden = events.find((event) => event.seq === selectedSeq)
  if (!hidden?.node_id) return null
  return (
    shown.find(
      (event) =>
        event.seq > hidden.seq && event.node_id === hidden.node_id && TERMINAL.has(event.event),
    ) ?? null
  )
}
