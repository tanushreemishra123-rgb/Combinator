/**
 * The right half of the trace drawer: everything one event knows.
 *
 * Trace visibility is scored, so this is deliberately exhaustive - input,
 * output, error, validation issues, attempt count, provider/mocked badge and
 * the raw payload, each copyable.
 */

import { Bot, CircleX, MousePointerClick, Sparkles } from 'lucide-react'
import type { TraceEvent } from '@/api/types'
import { CATALOG } from '@/blocks/catalog'
import EmptyState from '@/components/EmptyState'
import JsonViewer from '@/components/JsonViewer'
import StatusBadge from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { readAttempt, readError, readProviderMeta, readReview, readValidation } from './payload'
import { describe, formatClock, TONE_BG, TONE_TEXT } from './traceLabels'

interface Props {
  event: TraceEvent | null
  eventCount: number
  /** A `step_started` whose step has since finished: its recorded status is history, not now. */
  stale?: boolean
}

export default function StepInspector({ event, eventCount, stale = false }: Props) {
  if (!event) {
    return (
      <EmptyState
        Icon={MousePointerClick}
        title="Pick a moment to inspect"
        body={
          eventCount > 0
            ? 'Click any line in the timeline - or a block on the canvas - to see exactly what went in, what came out, and what went wrong.'
            : 'Run the workflow and every step will show up here as it happens.'
        }
      />
    )
  }

  const descriptor = describe(event)
  const meta = event.node_type ? CATALOG[event.node_type] : null // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: node_type is the BlockType union, not user input
  const attempt = readAttempt(event.payload)
  const error = readError(event.payload)
  const validation = readValidation(event.payload)
  const review = readReview(event.payload)
  const provider = readProviderMeta(event.payload)
  const hasInput = event.payload.input !== undefined
  const hasOutput = event.payload.output !== undefined
  const config = event.payload.config
  const detail = descriptor.detail(event)

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
            TONE_BG[descriptor.tone], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: descriptor.tone is a union of literal tone names, not user input
            TONE_TEXT[descriptor.tone], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: descriptor.tone is a union of literal tone names, not user input
          )}
        >
          <descriptor.Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm leading-snug font-semibold">{descriptor.title(event)}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {meta ? (
              <>
                <meta.Icon aria-hidden="true" className="size-3" />
                {meta.displayName}
              </>
            ) : (
              'Run event'
            )}
            {event.node_label ? ` · ${event.node_label}` : ''} · step #{event.seq} ·{' '}
            {formatClock(event.timestamp)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {stale ? (
          <Badge variant="secondary" className="font-normal">
            started, see the finished entry for the result
          </Badge>
        ) : (
          <StatusBadge status={event.status} label={event.status.replace(/_/g, ' ')} />
        )}
        {attempt !== null && (
          <Badge variant="secondary" className="font-normal">
            attempt {attempt}
          </Badge>
        )}
        {provider && (
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-normal',
              provider.mocked
                ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-success/30 bg-success/10 text-success',
            )}
          >
            {provider.mocked ? (
              <Bot aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {provider.mocked ? 'mocked' : 'live'}
            {provider.providerUsed ? ` · ${provider.providerUsed}` : ''}
          </Badge>
        )}
        {provider && provider.confidence !== null && (
          <Badge variant="secondary" className="font-normal">
            confidence {provider.confidence}
          </Badge>
        )}
        {validation && (
          <StatusBadge
            status={validation.passed ? 'completed' : 'failed'}
            label={
              validation.passed
                ? 'validation passed'
                : `${validation.issues.length} validation issue${validation.issues.length === 1 ? '' : 's'}`
            }
          />
        )}
      </div>

      {detail && <p className="text-sm leading-relaxed text-muted-foreground">{detail}</p>}

      {error && (
        <section className="rounded-xl bg-status-failed/8 p-3 ring-1 ring-status-failed/25">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-status-failed">
            <CircleX aria-hidden="true" className="size-3.5" />
            {error.kind.replace(/_/g, ' ')}
          </h4>
          <p className="mt-1 text-sm leading-relaxed">{error.message}</p>
        </section>
      )}

      {validation && validation.issues.length > 0 && (
        <section className="rounded-xl bg-status-paused/8 p-3 ring-1 ring-status-paused/25">
          <h4 className="text-xs font-semibold text-status-paused">Validation issues</h4>
          <ul className="mt-1.5 space-y-1.5 text-xs">
            {validation.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex flex-wrap items-baseline gap-1.5">
                <code className="rounded bg-muted px-1 py-0.5">{issue.field ?? 'output'}</code>
                <strong className="font-semibold">{issue.code}</strong>
                <span className="text-muted-foreground">{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review && (
        <div className="space-y-2">
          {review.prompt && (
            <p className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground italic">
              {review.prompt}
            </p>
          )}
          {review.note && (
            <p className="text-sm leading-relaxed text-muted-foreground">Note: {review.note}</p>
          )}
          {review.editedData !== undefined && (
            <JsonViewer label="Edited data" value={review.editedData} tone="warn" />
          )}
        </div>
      )}

      {hasInput && <JsonViewer label="Input" value={event.payload.input} />}
      {hasOutput && <JsonViewer label="Output" value={event.payload.output} tone="good" />}
      {config !== undefined && <JsonViewer label="Block config" value={config} />}
      <JsonViewer label="Raw event payload" value={event.payload} />
    </div>
  )
}
