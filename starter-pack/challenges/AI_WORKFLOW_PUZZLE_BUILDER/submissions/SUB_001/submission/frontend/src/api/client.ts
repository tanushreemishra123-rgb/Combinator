/**
 * Typed client for the backend HTTP API (shapes in ./types.ts).
 *
 * `ApiClient` covers every endpoint. Two implementations ship:
 *   - `HttpApiClient` - real fetch/EventSource calls against `/api`.
 *   - `MockApiClient`  - in-browser fixtures, so the UI is fully demonstrable
 *                        without a backend. Enabled with `VITE_MOCK_API=1`.
 */

import type {
  CreateRunRequest,
  HealthResponse,
  PuzzleDetail,
  PuzzleSummary,
  ReliabilityReport,
  ReviewDecisionRequest,
  RunAccepted,
  RunSummary,
  TraceEvent,
  ValidateWorkflowResponse,
  WorkflowDef,
} from './types'
import { ApiError } from './errors'
import { MockApiClient } from './mockClient'

export { ApiError } from './errors'

/* ------------------------------------------------------------------ */
/* SSE stream                                                          */
/* ------------------------------------------------------------------ */

export interface RunEventHandlers {
  /** Named SSE event `trace`. */
  onTrace?: (event: TraceEvent) => void
  /** Named SSE event `paused` - the run stopped for human review; stream closes. */
  onPaused?: (summary: RunSummary) => void
  /** Named SSE event `done` - the run reached a terminal state; stream closes. */
  onDone?: (summary: RunSummary) => void
  /** Transport-level failure (connection dropped, bad payload). */
  onError?: (error: Error) => void
}

export interface RunEventStream {
  /**
   * Attach handlers. Events already received are replayed to late
   * subscribers, so no event is lost between opening and subscribing.
   * Returns an unsubscribe function.
   */
  subscribe(handlers: RunEventHandlers): () => void
  /** Close the underlying transport and drop all subscribers. */
  close(): void
}

/* ------------------------------------------------------------------ */
/* Client interface                                                    */
/* ------------------------------------------------------------------ */

export interface ApiClient {
  /** `GET /api/health` */
  getHealth(): Promise<HealthResponse>
  /** `GET /api/puzzles` */
  listPuzzles(): Promise<PuzzleSummary[]>
  /** `GET /api/puzzles/{id}` */
  getPuzzle(id: string): Promise<PuzzleDetail>
  /** `POST /api/workflows/validate` */
  validateWorkflow(workflow: WorkflowDef): Promise<ValidateWorkflowResponse>
  /** `POST /api/runs` → `202 { run_id }` */
  createRun(request: CreateRunRequest): Promise<RunAccepted>
  /** `GET /api/runs/{run_id}/events` (SSE) */
  streamRunEvents(runId: string): RunEventStream
  /** `GET /api/runs/{run_id}` */
  getRun(runId: string): Promise<RunSummary>
  /** `POST /api/runs/{run_id}/review` → `202 { run_id }` */
  submitReview(runId: string, decision: ReviewDecisionRequest): Promise<RunAccepted>
  /** `POST /api/runs/{run_id}/resume-last` → `202 { run_id }` (a NEW run id) */
  resumeLast(runId: string): Promise<RunAccepted>
  /** `GET /api/runs/{run_id}/reliability` (409 while still running/paused) */
  getReliability(runId: string): Promise<ReliabilityReport>
}

/* ------------------------------------------------------------------ */
/* HTTP implementation                                                 */
/* ------------------------------------------------------------------ */

const API_BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf -- browser-side fetch of a same-origin relative URL: API_BASE is the '/api' constant above and every `path` is an internal literal from this module, so no user-controlled host is reachable
    response = await fetch(`${API_BASE}${path}`, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    })
  } catch (cause) {
    throw new ApiError(0, `Could not reach the server. ${String(cause)}`)
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object' && 'detail' in body) {
        detail = String((body as { detail: unknown }).detail)
      }
    } catch {
      /* non-JSON error body - keep the generic message */
    }
    throw new ApiError(response.status, detail)
  }

  return (await response.json()) as T
}

class EventSourceStream implements RunEventStream {
  private source: EventSource | null = null
  private readonly subscribers = new Set<RunEventHandlers>()
  private readonly history: Array<(handlers: RunEventHandlers) => void> = []
  private closed = false
  private readonly url: string

  constructor(url: string) {
    this.url = url
  }

  subscribe(handlers: RunEventHandlers): () => void {
    for (const apply of this.history) apply(handlers)
    this.subscribers.add(handlers)
    if (!this.source && !this.closed) this.open()
    return () => {
      this.subscribers.delete(handlers)
    }
  }

  close(): void {
    this.closed = true
    this.source?.close()
    this.source = null
    this.subscribers.clear()
  }

  private open(): void {
    const source = new EventSource(this.url)
    this.source = source

    source.addEventListener('trace', (event) => {
      this.dispatch<TraceEvent>(event, (payload, handlers) => handlers.onTrace?.(payload))
    })
    source.addEventListener('paused', (event) => {
      this.dispatch<RunSummary>(event, (payload, handlers) => handlers.onPaused?.(payload))
      source.close()
    })
    source.addEventListener('done', (event) => {
      this.dispatch<RunSummary>(event, (payload, handlers) => handlers.onDone?.(payload))
      source.close()
    })
    source.onerror = () => {
      // EventSource fires `error` both for a dropped connection and for the
      // normal close after `done`/`paused`; only surface the former.
      if (source.readyState === EventSource.CLOSED && !this.closed) {
        this.emit((handlers) => handlers.onError?.(new Error('Event stream disconnected')))
      }
    }
  }

  private dispatch<T>(event: MessageEvent, apply: (payload: T, h: RunEventHandlers) => void): void {
    let payload: T
    try {
      payload = JSON.parse(event.data as string) as T
    } catch {
      this.emit((handlers) => handlers.onError?.(new Error('Malformed event payload')))
      return
    }
    this.emit((handlers) => apply(payload, handlers))
  }

  /** Fan out to current subscribers and record for late ones. */
  private emit(apply: (handlers: RunEventHandlers) => void): void {
    this.history.push(apply)
    for (const handlers of this.subscribers) apply(handlers)
  }
}

export class HttpApiClient implements ApiClient {
  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health')
  }

  listPuzzles(): Promise<PuzzleSummary[]> {
    return request<PuzzleSummary[]>('/puzzles')
  }

  getPuzzle(id: string): Promise<PuzzleDetail> {
    return request<PuzzleDetail>(`/puzzles/${encodeURIComponent(id)}`)
  }

  validateWorkflow(workflow: WorkflowDef): Promise<ValidateWorkflowResponse> {
    return request<ValidateWorkflowResponse>('/workflows/validate', {
      method: 'POST',
      body: JSON.stringify({ workflow }),
    })
  }

  createRun(body: CreateRunRequest): Promise<RunAccepted> {
    return request<RunAccepted>('/runs', { method: 'POST', body: JSON.stringify(body) })
  }

  streamRunEvents(runId: string): RunEventStream {
    return new EventSourceStream(`${API_BASE}/runs/${encodeURIComponent(runId)}/events`)
  }

  getRun(runId: string): Promise<RunSummary> {
    return request<RunSummary>(`/runs/${encodeURIComponent(runId)}`)
  }

  submitReview(runId: string, decision: ReviewDecisionRequest): Promise<RunAccepted> {
    return request<RunAccepted>(`/runs/${encodeURIComponent(runId)}/review`, {
      method: 'POST',
      body: JSON.stringify(decision),
    })
  }

  resumeLast(runId: string): Promise<RunAccepted> {
    return request<RunAccepted>(`/runs/${encodeURIComponent(runId)}/resume-last`, {
      method: 'POST',
    })
  }

  getReliability(runId: string): Promise<ReliabilityReport> {
    return request<ReliabilityReport>(`/runs/${encodeURIComponent(runId)}/reliability`)
  }
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

export const usingMockApi = Boolean(import.meta.env.VITE_MOCK_API)

export const api: ApiClient = usingMockApi ? new MockApiClient() : new HttpApiClient()
