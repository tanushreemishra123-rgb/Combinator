/**
 * shadcn's resizable primitives (react-resizable-panels v4), restyled onto the
 * app's tokens: a hairline in `--border` that brightens to `--ring` on hover,
 * focus and drag, plus an optional grip chip in `--card` / `--muted-foreground`.
 *
 * The library places its own hit region around the separator (10px for a mouse,
 * 20px for a finger), so the bar itself can stay a true hairline without being
 * fiddly to grab, and without a fat invisible strip stealing canvas clicks.
 */

import { GripVertical } from 'lucide-react'
import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

/**
 * `data-separator` is set by the library to inactive / hover / focus / active /
 * disabled, which is what the states below hang off - the element is one pixel
 * wide, so plain `:hover` would almost never fire.
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'group relative flex w-px items-center justify-center bg-border outline-none transition-colors',
        'data-[separator=hover]:bg-ring/60 data-[separator=focus]:bg-ring data-[separator=active]:bg-ring',
        'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
        '[&[aria-orientation=horizontal]>div]:rotate-90',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            'z-10 flex h-7 w-3.5 items-center justify-center rounded-4xl border border-border bg-card text-muted-foreground transition-colors',
            'group-data-[separator=hover]:border-ring group-data-[separator=hover]:text-foreground',
            'group-data-[separator=focus]:border-ring group-data-[separator=focus]:text-foreground',
            'group-data-[separator=active]:border-ring group-data-[separator=active]:bg-ring group-data-[separator=active]:text-primary-foreground',
          )}
        >
          <GripVertical aria-hidden="true" className="size-3" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
