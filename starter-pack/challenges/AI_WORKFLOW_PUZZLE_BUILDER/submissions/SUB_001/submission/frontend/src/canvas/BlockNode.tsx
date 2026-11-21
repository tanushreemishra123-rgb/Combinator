/**
 * Custom React Flow node - a two-section workflow card.
 *
 * Header: category-tinted icon chip, the block type's name, the live status
 * dot. Body: the user's label, then up to three `key: value` config rows drawn
 * from the catalog's `summaryFields` (or the block's one-liner while it is
 * still at its defaults). Ports sit on the top and bottom edges.
 */

import type { AnimationEvent } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { Handshake } from 'lucide-react'
import type { StepStatus } from '@/api/types'
import CategoryIcon from '@/components/CategoryIcon'
import { STATUS_LABELS } from '@/components/status'
import { blockBlurb, CATALOG, configRows } from '@/blocks/catalog'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import type { BlockFlowNode } from './graphTypes'

/** How each live status paints the card. Every colour is a `--status-*` token. */
const STATUS_CARD: Partial<Record<StepStatus, string>> = {
  running: 'border-status-running ring-2 ring-status-running/30',
  retrying: 'border-status-retrying ring-2 ring-status-retrying/30',
  completed: 'border-status-completed ring-1 ring-status-completed/25',
  recovered: 'border-status-recovered ring-2 ring-status-recovered/25',
  failed: 'border-status-failed ring-2 ring-status-failed/30',
  paused: 'border-status-paused ring-2 ring-status-paused/30',
  safely_stopped: 'border-status-safely-stopped ring-2 ring-status-safely-stopped/30',
  skipped: 'border-dashed opacity-45 grayscale',
}

/** Statuses that are still in motion - their dot breathes for as long as they last. */
const BREATHING = new Set<StepStatus>(['running', 'retrying'])

/**
 * Statuses worth a one-shot pop when the step lands on them: something just
 * resolved. `running`/`retrying` are excluded (already breathing) and so are
 * `pending`/`skipped` - nothing happened to the step, so nothing should move.
 */
const POPPING = new Set<StepStatus>([
  'completed',
  'recovered',
  'failed',
  'paused',
  'safely_stopped',
])

export default function BlockNode({ id, data }: NodeProps<BlockFlowNode>) {
  const { updateNodeData } = useReactFlow()
  const reducedMotion = usePrefersReducedMotion()
  const meta = CATALOG[data.blockType] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: data.blockType is the BlockType union, not user input
  const rows = configRows(data.blockType, data.config)
  const status = data.status
  const pop = status !== null && POPPING.has(status)

  /**
   * The arrival pop is one-shot: once the card has played it, drop `fresh` so
   * no later re-render can replay it. Children animate too (the status pop),
   * so only the card's own animation counts.
   */
  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !data.fresh) return
    updateNodeData(id, { fresh: false })
  }

  return (
    <div
      className={cn(
        'block-node cat-tint status-tone relative w-[252px] rounded-[10px] border border-border bg-card shadow-sm transition-all duration-[120ms] hover:-translate-y-px hover:shadow-panel',
        status && STATUS_CARD[status],
        status === 'running' && 'animate-pulse',
        data.invalid && 'border-destructive ring-2 ring-destructive/30',
      )}
      data-category={meta.category}
      data-invalid={data.invalid}
      data-status={status ?? 'idle'}
      data-fresh={data.fresh && !reducedMotion ? 'true' : undefined}
      onAnimationEnd={onAnimationEnd}
    >
      {/* One 320ms ring flash per status landing; keyed so each change restarts it. */}
      {pop && !reducedMotion && <span key={status} aria-hidden="true" className="status-flash" />}
      {meta.allowsIncoming && <Handle type="target" position={Position.Top} />}

      <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <CategoryIcon type={data.blockType} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {meta.displayName}
        </span>
        {status && (
          <span
            // Keyed on the status so the pop keyframes restart on every change.
            key={status}
            data-status={status}
            data-pop={pop ? 'true' : undefined}
            title={STATUS_LABELS[status]}
            className={cn(
              'status-dot status-tone size-2.5 shrink-0 rounded-full bg-(--tone) ring-4 ring-(--tone)/15',
              BREATHING.has(status) && 'animate-pulse',
            )}
          >
            <span className="sr-only">{STATUS_LABELS[status]}</span>
          </span>
        )}
      </div>

      <div className="px-2.5 py-2">
        <div className="truncate text-sm font-semibold" title={data.label}>
          {data.label}
        </div>

        {rows.length > 0 ? (
          <dl className="mt-1.5 space-y-0.5">
            {rows.map((row) => (
              <div key={row.key} className="flex items-baseline gap-1.5 text-[0.68rem] leading-4">
                <dt className="shrink-0 text-muted-foreground">{row.key}</dt>
                <dd className="min-w-0 flex-1 truncate text-foreground/85" title={row.value}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 line-clamp-2 text-[0.68rem] leading-4 text-muted-foreground">
            {blockBlurb(data.blockType)}
          </p>
        )}
      </div>

      {meta.isGuard && (
        <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-1.5 text-[0.66rem] text-muted-foreground">
          <Handshake aria-hidden="true" className="size-3 shrink-0" />
          protects the next step
        </div>
      )}

      {meta.branching ? (
        <>
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            className="react-flow__handle--false"
          />
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            className="react-flow__handle--true"
          />
          <span className="absolute -bottom-5 left-4 text-[0.62rem] font-bold tracking-wider text-status-failed uppercase">
            false
          </span>
          <span className="absolute -bottom-5 right-4 text-[0.62rem] font-bold tracking-wider text-status-completed uppercase">
            true
          </span>
        </>
      ) : (
        meta.allowsOutgoing && <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  )
}
