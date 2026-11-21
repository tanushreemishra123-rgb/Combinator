/**
 * The workspace: palette (left), canvas (centre), inspector (right) and the
 * run dock along the bottom.
 *
 * Building and running share one `graph`: `toWorkflowDef()` is what gets
 * POSTed to `/api/runs`, and the statuses streaming back out of `useRun` are
 * painted onto the same nodes through `setNodeStatuses()`.
 *
 * Below `lg` the two side rails have nowhere to stand, so the same components
 * are re-seated in slide-over drawers and the topbar shrinks to icons. The
 * rails are mounted in one place or the other, never both - `ConfigForm` holds
 * draft state, and two of it would fight.
 *
 * Both axes are resizable. The horizontal group only grows separators when the
 * rails are inline; the canvas panel keeps its slot in the children array at
 * every width so React Flow is never remounted by crossing the breakpoint.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useGroupRef, usePanelRef, type Layout } from 'react-resizable-panels'
import { ArrowLeft, Blocks, Info, Loader, Play, SearchCheck, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/api/client'
import type { BlockType, PuzzleDetail } from '@/api/types'
import DifficultyBadge from '@/components/DifficultyBadge'
import AppHeader from '@/components/AppHeader'
import StatusBadge from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import WorkflowCanvas from '@/canvas/WorkflowCanvas'
import { useWorkflowGraph } from '@/canvas/useWorkflowGraph'
import Inspector from '@/builder/Inspector'
import Palette from '@/builder/Palette'
import {
  CANVAS_TOASTER_ID,
  dismissValidationToast,
  showValidationToast,
  type ValidationToastId,
} from '@/builder/validationToast'
import { useIsCompact } from '@/hooks/useIsCompact'
import { usePanelLayout } from '@/hooks/usePanelLayout'
import ReliabilityPanel from '@/run/ReliabilityPanel'
import ReviewModal from '@/run/ReviewModal'
import ScenarioToggle from '@/run/ScenarioToggle'
import TraceDrawer from '@/run/TraceDrawer'
import { useRun } from '@/run/useRun'

/**
 * Default rail widths, as percentages of the workspace row: about 270px for the
 * palette and 365px for the settings panel at 1920, the proportions the user
 * settled on. Percentages stay in proportion instead of snapping at one
 * breakpoint.
 */
const RAILS: Layout = { palette: 14, canvas: 67, inspector: 19 }

/** Default share for the run dock when it is open. */
const DOCK_WIDE: Layout = { workspace: 64, dock: 36 }

/** On a phone the dock needs most of the screen to be readable (it was 55dvh). */
const DOCK_COMPACT: Layout = { workspace: 45, dock: 55 }

/** The dock's shut height: exactly its own header bar, `h-11`. */
const DOCK_SHUT = '2.75rem'

const HANDLE_HINT = 'Drag to resize, double-click to reset'

/** Keys are namespaced so one viewer's builder layout cannot collide. */
const RAILS_KEY = 'awpb.builder.h'
const DOCK_KEY = 'awpb.builder.v'

/** Remounts per puzzle, so switching puzzles resets the canvas and any run. */
export default function Builder() {
  const { id = '' } = useParams<{ id: string }>()
  return <BuilderWorkspace key={id} puzzleId={id} />
}

/**
 * Wraps a topbar control in a tooltip only once its label has been squeezed
 * away, so the wide layout keeps exactly the markup and behaviour it had.
 */
function IconTip({
  when,
  label,
  children,
}: {
  when: boolean
  label: string
  children: ReactElement
}) {
  if (!when) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

function BuilderWorkspace({ puzzleId }: { puzzleId: string }) {
  const graph = useWorkflowGraph()
  const run = useRun()

  const [puzzle, setPuzzle] = useState<PuzzleDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const checkToast = useRef<ValidationToastId | null>(null)
  const [scenarioId, setScenarioId] = useState<string | null>(null)
  const [traceOpen, setTraceOpen] = useState(false)

  const compact = useIsCompact()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Resizable layout: two groups, each remembered under its own storage key.
  const railsGroup = useGroupRef()
  const dockGroup = useGroupRef()
  const dockPanel = usePanelRef()
  const { defaultLayout: railsLayout, save: storeRails } = usePanelLayout(RAILS_KEY, RAILS)
  const { defaultLayout: dockLayout, save: storeDock } = usePanelLayout(
    DOCK_KEY,
    compact ? DOCK_COMPACT : DOCK_WIDE,
  )

  /**
   * Below `lg` the rails are not mounted, so the group commits a one-panel
   * layout. Writing that would wipe the widths the wide layout is holding.
   */
  const saveRails = useCallback(
    (layout: Layout) => {
      if (!('palette' in layout)) return
      storeRails(layout)
    },
    [storeRails],
  )

  /**
   * Likewise, a shut dock commits its collapsed height; remembering that would
   * lose the height you dragged to, since re-opening restores the last size.
   *
   * The group only reports a layout once it has measured itself, so this is
   * also the signal that the imperative collapse below will actually land.
   */
  const dockIsOpen = useRef(false)
  const [dockReady, setDockReady] = useState(false)
  const saveDock = useCallback(
    (layout: Layout) => {
      setDockReady(true)
      if (!dockIsOpen.current) return
      storeDock(layout)
    },
    [storeDock],
  )

  // Ordered before the collapse effect below, so the guard is already correct
  // by the time collapsing commits a layout.
  useEffect(() => {
    dockIsOpen.current = traceOpen
  }, [traceOpen])

  /**
   * The chevron stays the one way in and out: it drives the panel, the panel
   * never drives it. `expand()` restores whatever height the dock last had,
   * which is the height `collapse()` banked on the way down.
   *
   * Waiting for `dockReady` matters on first paint: until the group has
   * measured itself it swallows imperative calls, and the dock would come up
   * open with the chevron insisting it was shut.
   */
  useEffect(() => {
    const panel = dockPanel.current
    if (!dockReady || !panel) return
    if (traceOpen) panel.expand()
    else panel.collapse()
  }, [dockPanel, dockReady, traceOpen])

  // Plain handlers: wrapping a `ref.current` read in `useCallback` only stops
  // the React compiler from optimising the component.
  const resetRails = () => {
    railsGroup.current?.setLayout(RAILS)
  }

  const resetDock = () => {
    dockGroup.current?.setLayout(compact ? DOCK_COMPACT : DOCK_WIDE)
  }

  const { loadWorkflow } = graph

  useEffect(() => {
    let cancelled = false
    api
      .getPuzzle(puzzleId)
      .then((detail) => {
        if (cancelled) return
        setPuzzle(detail)
        loadWorkflow(detail.starter_workflow)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : 'Could not load this puzzle.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [puzzleId, loadWorkflow])

  const { toWorkflowDef, setInvalidNodes, setNodeStatuses } = graph

  // Live status from the stream, painted onto the canvas.
  useEffect(() => {
    setNodeStatuses(run.statuses)
  }, [run.statuses, setNodeStatuses])

  // Clicking a block on the canvas pulls up what that block did in the run.
  const { selectedNodeId } = graph
  const { selectLatestForNode } = run
  useEffect(() => {
    if (selectedNodeId) selectLatestForNode(selectedNodeId)
  }, [selectedNodeId, selectLatestForNode])

  /**
   * With no right rail on screen, tapping a block has to bring its settings to
   * you. The last shown id is tracked in a ref rather than in the deps so that
   * merely crossing the breakpoint - or dropping a block from the palette
   * drawer - does not count as a new selection and pop the drawer open unasked.
   *
   * Widening the window puts both rails back inline, so nothing may stay
   * floating over them.
   */
  const shown = useRef<string | null>(null)
  const wasCompact = useRef(compact)
  useEffect(() => {
    const isNew = selectedNodeId !== shown.current
    const widened = wasCompact.current && !compact
    shown.current = selectedNodeId
    wasCompact.current = compact
    if (widened) {
      setPaletteOpen(false)
      setPanelOpen(false)
    } else if (compact && isNew && selectedNodeId) {
      setPanelOpen(true)
    }
  }, [compact, selectedNodeId])

  // Transport-level run errors surface as a toast, not as extra chrome.
  const { error: runError, dismissError } = run
  useEffect(() => {
    if (!runError) return
    toast.error(runError)
    dismissError()
  }, [runError, dismissError])

  // The finished-run phase is worth a nudge, once per run.
  const announced = useRef<string | null>(null)
  useEffect(() => {
    const summary = run.summary
    if (run.phase !== 'finished' || !summary || announced.current === summary.run_id) return
    announced.current = summary.run_id
    if (summary.status === 'completed') toast.success('Run completed - every step reached the finish line.')
    else if (summary.status === 'safely_stopped') toast.warning('The run stopped safely on purpose.')
    else toast.error('The run failed. Open the trace to see where it fell over.')
  }, [run.phase, run.summary])

  const handleCheck = useCallback(async () => {
    setChecking(true)
    dismissValidationToast(checkToast.current)
    try {
      let result
      try {
        result = await api.validateWorkflow(toWorkflowDef())
      } catch (cause: unknown) {
        result = {
          valid: false,
          errors: [
            {
              code: 'check_unavailable',
              message:
                cause instanceof Error ? cause.message : 'The checker is unavailable right now.',
            },
          ],
          warnings: [],
        }
      }
      setInvalidNodes(
        [...result.errors, ...result.warnings]
          .map((message) => message.node_id)
          .filter((nodeId): nodeId is string => Boolean(nodeId)),
      )
      checkToast.current = showValidationToast(result, {
        onFocusNode: (nodeId) => graph.selectNode(nodeId),
        onDismiss: () => {
          checkToast.current = null
          setInvalidNodes([])
        },
      })
    } finally {
      setChecking(false)
    }
  }, [toWorkflowDef, setInvalidNodes, graph])

  const { start } = run
  const handleRun = useCallback(
    (withScenario: string | null = scenarioId) => {
      dismissValidationToast(checkToast.current)
      checkToast.current = null
      setInvalidNodes([])
      setTraceOpen(true)
      void start({ workflow: toWorkflowDef(), puzzleId, scenarioId: withScenario })
    },
    [scenarioId, puzzleId, start, toWorkflowDef, setInvalidNodes],
  )

  const addBlock = useCallback((type: BlockType) => graph.addBlock(type), [graph])

  // From the drawer: drop the block, get out of the way, leave it on the canvas.
  const addAndClose = useCallback(
    (type: BlockType) => {
      shown.current = graph.addBlock(type)
      setPaletteOpen(false)
    },
    [graph],
  )

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-lg font-semibold">That puzzle is missing</h2>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button asChild>
          <Link to="/">Back to the puzzles</Link>
        </Button>
      </div>
    )
  }

  if (!puzzle) {
    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)] gap-px bg-border lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <Skeleton className="hidden h-full rounded-none lg:block" />
        <Skeleton className="h-full rounded-none" />
        <Skeleton className="hidden h-full rounded-none lg:block" />
      </div>
    )
  }

  const pendingReview = run.phase === 'paused' ? (run.summary?.pending_review ?? null) : null
  const canResume = run.summary?.status === 'failed'
  const firstScenario = puzzle.failure_scenarios[0] ?? null
  const runLabel = run.phase === 'finished' ? 'Run again' : 'Run workflow'
  const panelLabel = graph.selectedNode ? 'Block settings' : 'Puzzle brief'

  return (
    <ReactFlowProvider>
      <div className="flex h-full min-w-0 flex-col">
        <AppHeader
          modeBadgeClassName="max-sm:hidden"
          actions={
            <>
              {run.locked && (
                <StatusBadge
                  status={run.phase === 'paused' ? 'paused' : 'running'}
                  label={run.phase === 'paused' ? 'Waiting for you' : 'Running'}
                  className="h-6 px-2.5 max-sm:hidden"
                />
              )}
              <ScenarioToggle
                scenarios={puzzle.failure_scenarios}
                value={scenarioId}
                onChange={setScenarioId}
                disabled={run.locked}
                compact={compact}
              />
              <IconTip when={compact} label="Check workflow">
                <Button
                  variant="outline"
                  size={compact ? 'icon-sm' : 'sm'}
                  onClick={() => void handleCheck()}
                  disabled={checking || run.locked}
                  aria-label={compact ? 'Check workflow' : undefined}
                >
                  {checking ? (
                    <Loader aria-hidden="true" className="animate-spin" />
                  ) : (
                    <SearchCheck aria-hidden="true" />
                  )}
                  {!compact && 'Check workflow'}
                </Button>
              </IconTip>
              <IconTip when={compact} label={runLabel}>
                <Button
                  size={compact ? 'icon-sm' : 'sm'}
                  onClick={() => handleRun()}
                  disabled={run.locked || run.busy}
                  title={scenarioId ? 'Run with the armed failure scenario' : 'Run this workflow'}
                  aria-label={compact ? runLabel : undefined}
                >
                  {run.busy ? (
                    <Loader aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  {!compact && runLabel}
                </Button>
              </IconTip>
              {compact && (
                <IconTip when label={panelLabel}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPanelOpen(true)}
                    aria-label={panelLabel}
                  >
                    {graph.selectedNode ? (
                      <SlidersHorizontal aria-hidden="true" />
                    ) : (
                      <Info aria-hidden="true" />
                    )}
                  </Button>
                </IconTip>
              )}
            </>
          }
        >
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/" title="Back to the puzzles" aria-label="Back to the puzzles">
              <ArrowLeft aria-hidden="true" />
            </Link>
          </Button>
          {compact && (
            <IconTip when label="Blocks">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Blocks"
              >
                <Blocks aria-hidden="true" />
              </Button>
            </IconTip>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{puzzle.title}</h1>
            <p className="truncate text-xs text-muted-foreground">{puzzle.tagline}</p>
          </div>
          <DifficultyBadge difficulty={puzzle.difficulty} className="max-lg:hidden" />
        </AppHeader>

        <ResizablePanelGroup
          id="awpb-workspace"
          orientation="vertical"
          groupRef={dockGroup}
          defaultLayout={dockLayout}
          onLayoutChanged={saveDock}
          className="min-h-0 flex-1"
        >
          <ResizablePanel
            id="workspace"
            defaultSize="64%"
            minSize="30%"
            className="flex min-h-0 min-w-0"
            style={{ overflow: 'hidden' }}
          >
            <ResizablePanelGroup
              id="awpb-rails"
              orientation="horizontal"
              groupRef={railsGroup}
              defaultLayout={railsLayout}
              onLayoutChanged={saveRails}
            >
              {!compact && (
                <>
                  <ResizablePanel
                    id="palette"
                    defaultSize="17%"
                    minSize="12%"
                    maxSize="30%"
                    className="flex min-w-0"
                    style={{ overflow: 'hidden' }}
                  >
                    <Palette
                      available={puzzle.available_blocks}
                      onAdd={addBlock}
                      disabled={run.locked}
                      className="w-full flex-1 border-r-0"
                    />
                  </ResizablePanel>
                  <ResizableHandle
                    withHandle
                    disableDoubleClick
                    onDoubleClick={resetRails}
                    title={HANDLE_HINT}
                    aria-label={`Resize the blocks rail. ${HANDLE_HINT}`}
                  />
                </>
              )}

              <ResizablePanel
                id="canvas"
                defaultSize="59%"
                minSize="35%"
                className="flex min-w-0"
                style={{ overflow: 'hidden' }}
              >
                <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                  <WorkflowCanvas graph={graph} locked={run.locked} />
                  {/* Check-workflow results pop up over the canvas, not in the corner. */}
                  <Toaster
                    id={CANVAS_TOASTER_ID}
                    position="top-center"
                    closeButton
                    className="toaster group canvas-toaster"
                    offset={{ top: 16 }}
                    style={{ '--width': 'min(560px, calc(100% - 2rem))' } as CSSProperties}
                  />
                </main>
              </ResizablePanel>

              {!compact && (
                <>
                  <ResizableHandle
                    withHandle
                    disableDoubleClick
                    onDoubleClick={resetRails}
                    title={HANDLE_HINT}
                    aria-label={`Resize the settings rail. ${HANDLE_HINT}`}
                  />
                  <ResizablePanel
                    id="inspector"
                    defaultSize="24%"
                    minSize="18%"
                    maxSize="40%"
                    className="flex min-w-0"
                    style={{ overflow: 'hidden' }}
                  >
                    <Inspector
                      puzzle={puzzle}
                      graph={graph}
                      locked={run.locked}
                      className="w-full flex-1 border-l-0"
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Shut, the bar is not draggable: the chevron alone opens the dock. */}
          <ResizableHandle
            withHandle={traceOpen}
            disabled={!traceOpen}
            disableDoubleClick
            onDoubleClick={resetDock}
            style={traceOpen ? undefined : { cursor: 'default' }}
            title={traceOpen ? HANDLE_HINT : undefined}
            aria-label={traceOpen ? `Resize the run trace. ${HANDLE_HINT}` : undefined}
          />

          <ResizablePanel
            id="dock"
            panelRef={dockPanel}
            collapsible
            collapsedSize={DOCK_SHUT}
            defaultSize="36%"
            minSize="18%"
            maxSize="70%"
            className="flex min-h-0"
            style={{ overflow: 'hidden' }}
          >
            <TraceDrawer
              open={traceOpen}
              onToggle={() => setTraceOpen((current) => !current)}
              events={run.events}
              phase={run.phase}
              selectedSeq={run.selectedSeq}
              onSelect={run.selectEvent}
              grade={run.report?.grade ?? null}
              onOpenReport={run.openReport}
            />
          </ResizablePanel>
        </ResizablePanelGroup>

        {compact && (
          <>
            <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
              <SheetContent
                side="left"
                aria-describedby={undefined}
                className="gap-0 overflow-hidden bg-sidebar p-0 data-[side=left]:w-[min(20rem,86vw)]"
              >
                <SheetTitle className="sr-only">Blocks</SheetTitle>
                <Palette
                  available={puzzle.available_blocks}
                  onAdd={addAndClose}
                  disabled={run.locked}
                  className="min-h-0 flex-1 border-r-0"
                />
              </SheetContent>
            </Sheet>

            <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
              <SheetContent
                side="right"
                showCloseButton={false}
                aria-describedby={undefined}
                className="gap-0 overflow-hidden bg-sidebar p-0 data-[side=right]:w-[min(24rem,92vw)]"
              >
                <SheetTitle className="sr-only">{panelLabel}</SheetTitle>
                <Inspector
                  puzzle={puzzle}
                  graph={graph}
                  locked={run.locked}
                  className="min-h-0 flex-1 border-l-0"
                  onClose={() => setPanelOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {pendingReview && (
        <ReviewModal
          request={pendingReview}
          busy={run.busy}
          onDecide={(decision) => void run.decide(decision)}
        />
      )}

      {run.report && run.reportOpen && (
        <ReliabilityPanel
          report={run.report}
          status={run.summary?.status ?? null}
          canResume={canResume}
          scenarioArmed={scenarioId !== null}
          hasScenarios={puzzle.failure_scenarios.length > 0}
          busy={run.busy}
          onClose={run.closeReport}
          onRunAgain={() => {
            run.closeReport()
            handleRun()
          }}
          onBreakIt={() => {
            if (!firstScenario) return
            setScenarioId(firstScenario.id)
            run.closeReport()
            handleRun(firstScenario.id)
          }}
          onResumeLast={() => {
            run.closeReport()
            setTraceOpen(true)
            void run.resumeLast()
          }}
        />
      )}
    </ReactFlowProvider>
  )
}
