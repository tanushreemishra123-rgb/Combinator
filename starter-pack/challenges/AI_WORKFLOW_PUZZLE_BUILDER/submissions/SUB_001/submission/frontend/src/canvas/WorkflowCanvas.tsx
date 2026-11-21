/** The React Flow canvas: drop target for the palette, selection, deletion. */

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  type Connection,
  type ConnectionLineComponentProps,
  type EdgeProps,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './canvas.css'
import { Trash2, X } from 'lucide-react'
import type { BlockType } from '@/api/types'
import { CATALOG, type BlockCategory } from '@/blocks/catalog'
import { useIsCompact } from '@/hooks/useIsCompact'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'
import BlockNode from './BlockNode'
import { BLOCK_DRAG_TYPE, EDGE_TYPE, type BlockFlowEdge, type BlockFlowNode } from './graphTypes'
import { NODE_WIDTH } from './layout'
import type { WorkflowGraph } from './useWorkflowGraph'

const nodeTypes = { block: BlockNode }

/**
 * React Flow ends a Top-handle edge at the handle box's top edge, a few pixels
 * clear of the port circle. Nudging the end down parks the line on the port.
 */
const PORT_REACH = 4

/**
 * How long a signal dot takes to travel one wire. Slow enough to read as a
 * hand-off between two steps rather than a spinner.
 */
const SIGNAL_DUR = '1.1s'

/** Our one edge: a smoothstep path with softer corners, meeting the target port. */
function FlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  style,
  selected,
  data,
}: EdgeProps<BlockFlowEdge>) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY: targetPosition === Position.Top ? targetY + PORT_REACH : targetY,
    targetPosition,
  })
  const removable = !data?.locked && (selected || data?.hovered)
  const drawing = data?.fresh === true
  const onDrawn = data?.onDrawn
  return (
    <>
      {/* While the wire is drawing itself in, the finished line stays out of the way. */}
      <BaseEdge id={id} path={path} style={style} className={drawing ? 'edge-drawing' : undefined} />

      {drawing && (
        <path
          d={path}
          pathLength={1}
          fill="none"
          className="edge-draw"
          onAnimationEnd={() => onDrawn?.(id)}
        />
      )}

      {/* React Flow's documented "Animating Edges" pattern: a <circle> carried
          along the same `edgePath` by SVG <animateMotion>. The library's own
          `animated` dashes stay on underneath, so the dot is kept small. */}
      {data?.active && (
        <g className="edge-signal" aria-hidden="true">
          <circle r={6} className="edge-signal-glow">
            <animateMotion dur={SIGNAL_DUR} repeatCount="indefinite" path={path} />
          </circle>
          <circle r={2.5} fill="var(--status-running)">
            <animateMotion dur={SIGNAL_DUR} repeatCount="indefinite" path={path} />
          </circle>
        </g>
      )}
      {removable && (
        <EdgeLabelRenderer>
          <button
            type="button"
            aria-label="Remove this connection"
            title="Remove this connection"
            className={cn(
              'pointer-events-auto absolute flex size-5 items-center justify-center rounded-full',
              'border border-border bg-card text-muted-foreground shadow-sm transition-colors',
              'hover:border-destructive hover:bg-destructive hover:text-background',
            )}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(event) => {
              event.stopPropagation()
              void deleteElements({ edges: [{ id }] })
            }}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = { [EDGE_TYPE]: FlowEdge }

const defaultEdgeOptions = { type: EDGE_TYPE } as const

/** The in-flight connection line, so the dragged edge carries the same chevron. */
function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })
  return (
    <g>
      <path d={path} fill="none" />
    </g>
  )
}

const MINIMAP_COLORS: Record<BlockCategory, string> = {
  Core: 'var(--cat-core)',
  Reliability: 'var(--cat-reliability)',
  'Human Control': 'var(--cat-human)',
}

interface Props {
  graph: WorkflowGraph
  /** True while a run owns the workflow - clicking still inspects, editing is off. */
  locked?: boolean
}

export default function WorkflowCanvas({ graph, locked = false }: Props) {
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [dropping, setDropping] = useState(false)

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (locked || !event.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setDropping(true)
    },
    [locked],
  )

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      setDropping(false)
      if (locked) return
      const raw = event.dataTransfer.getData(BLOCK_DRAG_TYPE)
      if (!raw || !(raw in CATALOG)) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      // Drop the card centred on the cursor, a little above it.
      graph.addBlock(raw as BlockType, { x: position.x - NODE_WIDTH / 2, y: position.y - 34 })
    },
    [graph, locked, screenToFlowPosition],
  )

  const onNodeClick = useCallback<NodeMouseHandler<BlockFlowNode>>(
    (_event, node) => graph.selectNode(node.id),
    [graph],
  )

  /* ---- Drag a block onto the bin to delete it ---- */

  const binRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [overBin, setOverBin] = useState(false)

  /** Node drags are pointer-based, so the bin is hit-tested against the pointer. */
  const pointerOverBin = useCallback((event: MouseEvent | TouchEvent): boolean => {
    const rect = binRef.current?.getBoundingClientRect()
    if (!rect) return false
    const point = 'touches' in event ? event.changedTouches[0] : event
    if (!point) return false
    return (
      point.clientX >= rect.left &&
      point.clientX <= rect.right &&
      point.clientY >= rect.top &&
      point.clientY <= rect.bottom
    )
  }, [])

  const onNodeDragStart = useCallback<OnNodeDrag<BlockFlowNode>>(() => {
    if (locked) return
    setDragging(true)
  }, [locked])

  const onNodeDrag = useCallback<OnNodeDrag<BlockFlowNode>>(
    (event) => setOverBin(pointerOverBin(event)),
    [pointerOverBin],
  )

  const onNodeDragStop = useCallback<OnNodeDrag<BlockFlowNode>>(
    (event, node) => {
      setDragging(false)
      setOverBin(false)
      if (!locked && pointerOverBin(event)) graph.deleteNode(node.id)
    },
    [graph, locked, pointerOverBin],
  )

  const minimapColor = useCallback(
    (node: BlockFlowNode) => MINIMAP_COLORS[CATALOG[node.data.blockType].category], // nosemgrep: gitlab.eslint.detect-object-injection -- two typed key lookups: BlockType into CATALOG, then BlockCategory into MINIMAP_COLORS; neither key is user input
    [],
  )

  /* ---- Edge hover (shows the × remove button) and reconnect-or-detach ---- */

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const reconnected = useRef(false)
  /** The edge being re-routed by one end, so validation ignores its old slot. */
  const reconnecting = useRef<string | null>(null)

  const onReconnect = useCallback(
    (oldEdge: (typeof graph.edges)[number], connection: Connection) => {
      if (locked) return
      reconnected.current = graph.reconnect(oldEdge, connection)
    },
    [graph, locked],
  )

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: (typeof graph.edges)[number]) => {
      // Dropped in empty space (no successful reconnect) = detach the edge.
      if (!locked && !reconnected.current) graph.deleteEdge(edge.id)
      reconnected.current = false
      reconnecting.current = null
    },
    [graph, locked],
  )

  /**
   * Idle edges stay calm; the one feeding the step in flight gets the muted
   * dashes plus a signal dot travelling along it. The dot is SMIL, which no
   * media query can reach, so reduced motion drops it here.
   */
  const reducedMotion = usePrefersReducedMotion()
  const clearEdgeFresh = graph.clearEdgeFresh
  const edges = useMemo(() => {
    const active = new Set(
      graph.nodes
        .filter((node) => node.data.status === 'running' || node.data.status === 'retrying')
        .map((node) => node.id),
    )
    return graph.edges.map((edge) => ({
      ...edge,
      animated: active.has(edge.target) || undefined,
      data: {
        ...edge.data,
        fresh: (!reducedMotion && edge.data?.fresh) || undefined,
        active: (!reducedMotion && active.has(edge.target)) || undefined,
        hovered: edge.id === hoveredEdge,
        locked,
        onDrawn: clearEdgeFresh,
      },
    }))
  }, [clearEdgeFresh, graph.edges, graph.nodes, hoveredEdge, locked, reducedMotion])

  /**
   * A run has just taken the canvas: frame the whole workflow once, so every
   * step is on screen before the statuses start painting.
   */
  const fitOptions = useMemo(
    () => ({ duration: reducedMotion ? 0 : 400, padding: 0.28, maxZoom: 1 }),
    [reducedMotion],
  )
  const wasLocked = useRef(locked)
  useEffect(() => {
    if (locked && !wasLocked.current) void fitView(fitOptions)
    wasLocked.current = locked
  }, [fitOptions, fitView, locked])

  const empty = graph.nodes.length === 0
  const compact = useIsCompact()
  const hint = useMemo(() => {
    if (locked) return 'Run in progress - click a block to inspect what it did'
    if (compact) {
      return empty ? 'Open Blocks to add your first step' : 'Tap a block to open its settings'
    }
    return empty ? 'Drag a block from the left to start building' : null
  }, [compact, empty, locked])

  const binActive = dragging && !locked

  return (
    <div
      className="canvas relative size-full bg-canvas-ground"
      data-locked={locked}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={graph.nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={graph.onNodesChange}
        onEdgesChange={graph.onEdgesChange}
        onConnect={graph.onConnect}
        isValidConnection={(connection) => graph.isValidConnection(connection, reconnecting.current)}
        onReconnectStart={(_event, edge) => {
          reconnected.current = false
          reconnecting.current = edge.id
        }}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onEdgeMouseEnter={(_event, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => graph.selectNode(null)}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        edgesReconnectable={!locked}
        deleteKeyCode={locked ? null : ['Delete', 'Backspace']}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineComponent={ConnectionLine}
        connectionRadius={34}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={2} color="var(--canvas-dot)" />
        <Controls showInteractive={false} fitViewOptions={fitOptions} />
        <MiniMap
          pannable
          zoomable
          nodeColor={minimapColor}
          nodeStrokeWidth={0}
          bgColor="var(--card)"
          maskColor="var(--canvas-mask)"
        />
      </ReactFlow>

      <div
        className={cn(
          'pointer-events-none absolute inset-3 z-[4] rounded-2xl border-2 border-dashed border-primary bg-primary/5 opacity-0 transition-opacity duration-150',
          dropping && 'opacity-100',
        )}
        aria-hidden="true"
      />

      {/* Hint pill - while a block is being dragged it becomes the bin; gone when idle with nothing to say. */}
      {(binActive || hint) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[5] flex justify-center">
          <div
            ref={binRef}
            data-bin={binActive}
            data-over={overBin}
            className={cn(
              'flex max-w-[calc(100%-6rem)] items-center gap-2 rounded-4xl border shadow-sm backdrop-blur-md transition-all duration-150',
              binActive
                ? 'border-dashed border-destructive/60 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive'
                : 'border-border bg-card/85 px-3.5 py-1.5 text-xs text-muted-foreground',
              binActive && overBin && 'scale-105 border-solid bg-destructive text-background shadow-lift',
            )}
          >
            {binActive ? (
              <>
                <Trash2 aria-hidden="true" className="size-4 shrink-0" />
                Drop here to delete
              </>
            ) : (
              <span className="truncate">{hint}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
