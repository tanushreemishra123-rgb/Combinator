/**
 * The bottom dock: a friendly chronological timeline of the run on the left,
 * the full detail of whichever moment you pick on the right.
 *
 * Opens itself when a run starts and follows the tail until you click an
 * entry, at which point it stops stealing your scroll position.
 *
 * The dock fills its resizable panel, so its height belongs to `Builder`: shut,
 * the panel collapses to this header's own `h-11`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Gauge, ListTree } from 'lucide-react'
import type { ReliabilityGrade, TraceEvent } from '@/api/types'
import GradeBadge from '@/components/GradeBadge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import StepInspector from './StepInspector'
import { collapseTimeline, openStarts, resolveSelection } from './timeline'
import { describe, formatClock, TONE_BG, TONE_TEXT } from './traceLabels'
import type { RunPhase } from './useRun'

interface Props {
  open: boolean
  onToggle: () => void
  events: TraceEvent[]
  phase: RunPhase
  selectedSeq: number | null
  onSelect: (seq: number) => void
  /** Set once the reliability report has landed. */
  grade: ReliabilityGrade | null
  onOpenReport: () => void
}

const PHASE_TEXT: Record<RunPhase, string> = {
  idle: 'Not run yet',
  starting: 'Starting…',
  running: 'Running',
  paused: 'Waiting for your decision',
  finished: 'Finished',
}

const PHASE_TONE: Record<RunPhase, string> = {
  idle: 'text-muted-foreground',
  starting: 'text-status-running',
  running: 'text-status-running',
  paused: 'text-status-paused',
  finished: 'text-status-completed',
}

export default function TraceDrawer({
  open,
  onToggle,
  events,
  phase,
  selectedSeq,
  onSelect,
  grade,
  onOpenReport,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  // One row per step by default; "All events" shows the raw started/finished pairs.
  const [showAll, setShowAll] = useState(false)
  const shown = useMemo(() => (showAll ? events : collapseTimeline(events)), [events, showAll])
  const runningStarts = useMemo(() => openStarts(events), [events])
  const selected = useMemo(
    () => resolveSelection(events, shown, selectedSeq),
    [events, shown, selectedSeq],
  )

  // Follow the tail while nothing is pinned, so a live run reads like a feed.
  useEffect(() => {
    if (!open || selectedSeq !== null) return
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [shown.length, open, selectedSeq])

  const live = phase === 'running' || phase === 'starting'

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-card"
      aria-label="Run trace"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 px-2 sm:gap-3 sm:px-3">
        <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          Run trace
          <span className="ml-1 rounded-4xl bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
            {shown.length}
          </span>
        </Button>

        <span
          className={cn('flex min-w-0 items-center gap-1.5 truncate text-xs font-medium', /* nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: phase is a union of literal phase names, not user input */ PHASE_TONE[phase])}
        >
          {live && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
          )}
          {/* nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: phase is a union of literal phase names, not user input */ PHASE_TEXT[phase]}
        </span>

        {open && events.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('ml-auto', showAll && 'text-primary')}
            onClick={() => setShowAll((value) => !value)}
            aria-pressed={showAll}
            title={showAll ? 'Showing every event; click for one row per step' : 'Showing one row per step; click for every event'}
          >
            <ListTree aria-hidden="true" />
            <span className="max-sm:sr-only">{showAll ? 'All events' : 'Steps'}</span>
          </Button>
        )}

        {grade && (
          <div className={cn('flex shrink-0 items-center gap-2', !(open && events.length > 0) && 'ml-auto')}>
            <GradeBadge grade={grade} />
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenReport}
              aria-label="Reliability report"
              title="Reliability report"
            >
              <Gauge aria-hidden="true" />
              <span className="max-sm:sr-only">Reliability report</span>
            </Button>
          </div>
        )}
      </header>

      {open && (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,45%)_minmax(0,1fr)] border-t border-border lg:grid-cols-[minmax(300px,40%)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <div
            ref={listRef}
            className="min-h-0 overflow-y-auto border-b border-border p-2 lg:border-r lg:border-b-0"
          >
            {events.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing yet - press <strong className="font-semibold">Run workflow</strong> and the
                story of the run appears here.
              </p>
            )}
            <ol className="space-y-0.5">
              {shown.map((event) => {
                const descriptor = describe(event)
                const detail = descriptor.detail(event)
                const isSelected = event.seq === selectedSeq
                return (
                  <li key={event.seq}>
                    <button
                      type="button"
                      className={cn(
                        'animate-drift flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted',
                      )}
                      onClick={() => onSelect(event.seq)}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg',
                          TONE_BG[descriptor.tone], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: descriptor.tone is a union of literal tone names, not user input
                          TONE_TEXT[descriptor.tone], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: descriptor.tone is a union of literal tone names, not user input
                        )}
                      >
                        <descriptor.Icon aria-hidden="true" className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.82rem] font-medium">
                          {descriptor.title(event)}
                        </span>
                        {detail && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {detail}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-[0.68rem] tabular-nums text-muted-foreground/70">
                        {formatClock(event.timestamp)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="min-h-0 overflow-y-auto">
            <StepInspector
              event={selected}
              eventCount={events.length}
              stale={selected?.event === 'step_started' && !runningStarts.has(selected.seq)}
            />
          </div>
        </div>
      )}
    </section>
  )
}
