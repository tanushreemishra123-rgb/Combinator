/**
 * The run lifecycle as one hook: start → stream → (pause for review) → finish.
 *
 * Deliberately plain React state - a run is a small state machine and a list of
 * events, and nothing else in the app needs to read it. `Builder` consumes this
 * and hands the pieces to the trace drawer, the review modal and the report.
 *
 *   idle ──start──▶ running ──▶ finished
 *                     │  ▲          │
 *              paused ┘  └ decision ┘
 *
 * Events are deduplicated by `seq`, because the contract's stream replays from
 * seq 1 every time it is re-opened (which is exactly what happens after a
 * human review decision).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type RunEventStream } from '../api/client'
import { ApiError } from '../api/errors'
import type {
  ReliabilityReport,
  ReviewDecisionRequest,
  RunSummary,
  StepStatus,
  TraceEvent,
  WorkflowDef,
} from '../api/types'

export type RunPhase = 'idle' | 'starting' | 'running' | 'paused' | 'finished'

export interface StartOptions {
  workflow: WorkflowDef
  puzzleId: string
  scenarioId: string | null
}

export interface RunController {
  phase: RunPhase
  runId: string | null
  events: TraceEvent[]
  /** node_id → latest status, for painting the canvas. */
  statuses: Record<string, StepStatus>
  summary: RunSummary | null
  report: ReliabilityReport | null
  reportOpen: boolean
  error: string | null
  /** A request (start / review / resume) is in flight. */
  busy: boolean
  /** True while the workflow must not be edited. */
  locked: boolean
  selectedSeq: number | null

  start: (options: StartOptions) => Promise<void>
  decide: (decision: ReviewDecisionRequest) => Promise<void>
  resumeLast: () => Promise<void>
  selectEvent: (seq: number | null) => void
  selectLatestForNode: (nodeId: string) => void
  openReport: () => void
  closeReport: () => void
  dismissError: () => void
}

function messageOf(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return fallback
}

export function useRun(): RunController {
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const [report, setReport] = useState<ReliabilityReport | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)

  const streamRef = useRef<RunEventStream | null>(null)
  const seenRef = useRef(new Set<number>())
  const eventsRef = useRef<TraceEvent[]>([])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  const closeStream = useCallback(() => {
    streamRef.current?.close()
    streamRef.current = null
  }, [])

  useEffect(() => closeStream, [closeStream])

  const loadReport = useCallback(async (id: string) => {
    try {
      setReport(await api.getReliability(id))
      setReportOpen(true)
    } catch (cause: unknown) {
      setError(messageOf(cause, 'The reliability report is not available for this run.'))
    }
  }, [])

  /** Open (or re-open) the stream for `id`. Replayed events are deduped by seq. */
  const follow = useCallback(
    (id: string, options: { fresh: boolean }) => {
      closeStream()
      if (options.fresh) {
        seenRef.current = new Set()
        setEvents([])
        setSelectedSeq(null)
      }

      const stream = api.streamRunEvents(id)
      streamRef.current = stream
      stream.subscribe({
        onTrace: (event) => {
          if (seenRef.current.has(event.seq)) return
          seenRef.current.add(event.seq)
          setEvents((current) => [...current, event].sort((a, b) => a.seq - b.seq))
        },
        onPaused: (paused) => {
          setSummary(paused)
          setPhase('paused')
        },
        onDone: (done) => {
          setSummary(done)
          setPhase('finished')
          void loadReport(done.run_id)
        },
        onError: (cause) => setError(cause.message),
      })
    },
    [closeStream, loadReport],
  )

  const start = useCallback(
    async ({ workflow, puzzleId, scenarioId }: StartOptions) => {
      setBusy(true)
      setError(null)
      setReport(null)
      setReportOpen(false)
      setSummary(null)
      setPhase('starting')
      try {
        const accepted = await api.createRun({
          workflow,
          puzzle_id: puzzleId,
          ...(scenarioId ? { scenario_id: scenarioId } : {}),
        })
        setRunId(accepted.run_id)
        setPhase('running')
        follow(accepted.run_id, { fresh: true })
      } catch (cause: unknown) {
        setPhase('idle')
        setError(messageOf(cause, 'The run could not be started.'))
      } finally {
        setBusy(false)
      }
    },
    [follow],
  )

  const decide = useCallback(
    async (decision: ReviewDecisionRequest) => {
      if (!runId) return
      setBusy(true)
      setError(null)
      try {
        await api.submitReview(runId, decision)
        setPhase('running')
        // The stream replays from seq 1 - dedupe keeps the timeline intact.
        follow(runId, { fresh: false })
      } catch (cause: unknown) {
        setError(messageOf(cause, 'That decision could not be submitted.'))
      } finally {
        setBusy(false)
      }
    },
    [runId, follow],
  )

  const resumeLast = useCallback(async () => {
    if (!runId) return
    setBusy(true)
    setError(null)
    setReport(null)
    setReportOpen(false)
    setSummary(null)
    try {
      const accepted = await api.resumeLast(runId)
      setRunId(accepted.run_id)
      setPhase('running')
      follow(accepted.run_id, { fresh: true })
    } catch (cause: unknown) {
      setError(messageOf(cause, 'This run cannot be resumed.'))
    } finally {
      setBusy(false)
    }
  }, [runId, follow])

  const selectLatestForNode = useCallback((nodeId: string) => {
    const latest = eventsRef.current.findLast((event) => event.node_id === nodeId)
    if (latest) setSelectedSeq(latest.seq)
  }, [])

  const statuses = useMemo(() => {
    const map: Record<string, StepStatus> = {}
    for (const event of events) {
      if (event.node_id) map[event.node_id] = event.status // nosemgrep: gitlab.eslint.detect-object-injection -- keys are node ids from our own trace, written into a fresh local object literal that is never used as a prototype
    }
    return map
  }, [events])

  const locked = phase === 'starting' || phase === 'running' || phase === 'paused'

  return {
    phase,
    runId,
    events,
    statuses,
    summary,
    report,
    reportOpen,
    error,
    busy,
    locked,
    selectedSeq,
    start,
    decide,
    resumeLast,
    selectEvent: setSelectedSeq,
    selectLatestForNode,
    openReport: () => setReportOpen(true),
    closeReport: () => setReportOpen(false),
    dismissError: () => setError(null),
  }
}
