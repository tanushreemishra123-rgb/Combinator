/**
 * Left rail: the block palette, grouped by catalog category.
 * Blocks can be dragged onto the canvas or clicked to drop into place.
 */

import type { DragEvent } from 'react'
import type { BlockType } from '@/api/types'
import { blocksByCategory, CATEGORY_META, type BlockMeta } from '@/blocks/catalog'
import { BLOCK_DRAG_TYPE } from '@/canvas/graphTypes'
import CategoryIcon from '@/components/CategoryIcon'
import { useIsCompact } from '@/hooks/useIsCompact'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  /** The puzzle's `available_blocks`; everything else is shown as locked. */
  available: BlockType[]
  onAdd: (type: BlockType) => void
  /** True while a run is in flight - the workflow is frozen until it ends. */
  disabled?: boolean
  /** Lets the narrow layout re-seat the same rail inside a slide-over drawer. */
  className?: string
}

function handleDragStart(event: DragEvent<HTMLButtonElement>, type: BlockType) {
  event.dataTransfer.setData(BLOCK_DRAG_TYPE, type)
  event.dataTransfer.effectAllowed = 'copy'
}

/** The catalog description is written as "Name - what it does"; show the tail. */
function tail(description: string): string {
  return description.split('-').slice(1).join('-').trim()
}

function PaletteItem({
  meta,
  locked,
  onAdd,
  /** In the drawer there is no room to the right, so the tip goes underneath. */
  side,
}: {
  meta: BlockMeta
  locked: boolean
  onAdd: () => void
  side: 'right' | 'bottom'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-start gap-2.5 rounded-xl border border-transparent p-2 text-left transition-colors',
            locked
              ? 'cursor-not-allowed opacity-40'
              : 'cursor-grab hover:border-border hover:bg-card active:cursor-grabbing',
          )}
          draggable={!locked}
          disabled={locked}
          onDragStart={(event) => handleDragStart(event, meta.type)}
          onClick={onAdd}
        >
          <CategoryIcon type={meta.type} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.82rem] font-medium">{meta.displayName}</span>
            <span className="mt-0.5 block text-[0.72rem] leading-snug text-muted-foreground">
              {tail(meta.description)}
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {locked ? `${meta.displayName} is not part of this puzzle` : meta.description}
      </TooltipContent>
    </Tooltip>
  )
}

export default function Palette({ available, onAdd, disabled = false, className }: Props) {
  const availableSet = new Set(available)
  const compact = useIsCompact()

  return (
    <aside className={cn('flex min-h-0 flex-col border-r border-border bg-sidebar', className)}>
      <header className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Blocks</h2>
        <p className="mt-0.5 pr-8 text-xs text-muted-foreground lg:pr-0">
          {disabled
            ? 'Frozen while the run is in flight'
            : compact
              ? 'Tap a block to drop it on the canvas'
              : 'Drag blocks to build your workflow'}
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-3">
          {blocksByCategory().map(([category, metas]) => (
            <section key={category} data-category={category} className="cat-tint space-y-1">
              <h3 className="flex items-center gap-2 px-2 text-[0.7rem] font-semibold tracking-wider uppercase">
                <span className="size-1.5 rounded-full bg-(--tint)" aria-hidden="true" />
                {category}
              </h3>
              <p className="px-2 pb-1 text-[0.72rem] text-muted-foreground">
                {/* nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: category is the BlockCategory union, not user input */ CATEGORY_META[category].blurb}
              </p>
              {metas.map((meta) => (
                <PaletteItem
                  key={meta.type}
                  meta={meta}
                  locked={disabled || (availableSet.size > 0 && !availableSet.has(meta.type))}
                  onAdd={() => onAdd(meta.type)}
                  side={compact ? 'bottom' : 'right'}
                />
              ))}
            </section>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
