/**
 * Right rail. Shows the selected block's config form, or the puzzle brief when
 * nothing is selected.
 */

import { ArrowLeft, X } from 'lucide-react'
import type { PuzzleDetail } from '@/api/types'
import type { WorkflowGraph } from '@/canvas/useWorkflowGraph'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import ConfigForm from './ConfigForm'
import PuzzleBrief from './PuzzleBrief'

interface Props {
  puzzle: PuzzleDetail
  graph: WorkflowGraph
  /** True while a run owns the workflow. */
  locked?: boolean
  /** Lets the narrow layout re-seat the same rail inside a slide-over drawer. */
  className?: string
  /** Only set in the drawer, where the rail has to be dismissable. */
  onClose?: () => void
}

export default function Inspector({
  puzzle,
  graph,
  locked = false,
  className,
  onClose,
}: Props) {
  const node = graph.selectedNode

  return (
    <aside className={cn('flex min-h-0 flex-col border-l border-border bg-sidebar', className)}>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="truncate text-sm font-semibold">{node ? 'Block settings' : 'Puzzle brief'}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {node && (
            <Button variant="ghost" size="xs" onClick={() => graph.selectNode(null)}>
              <ArrowLeft aria-hidden="true" />
              Brief
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label="Close the panel"
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {node ? (
          <ConfigForm
            key={node.id}
            blockType={node.data.blockType}
            label={node.data.label}
            config={node.data.config}
            tools={puzzle.tools}
            onLabelChange={(label) => graph.updateNodeLabel(node.id, label)}
            onConfigChange={(config) => graph.updateNodeConfig(node.id, config)}
            onDelete={() => graph.deleteNode(node.id)}
            readOnly={locked}
          />
        ) : (
          <PuzzleBrief puzzle={puzzle} />
        )}
      </ScrollArea>
    </aside>
  )
}
