/**
 * The canvas graph as a hook: load a `WorkflowDef` in, edit it, serialise it
 * back out. The run/trace task reuses this - `toWorkflowDef()` is what gets
 * POSTed to `/api/runs`, and `setNodeStatuses()` is the seam for live status.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition,
} from '@xyflow/react'
import type { BlockType, EdgeDef, NodeDef, StepStatus, WorkflowDef } from '../api/types'
import { CATALOG, defaultConfig } from '../blocks/catalog'
import { EDGE_TYPE, type BlockFlowEdge, type BlockFlowNode } from './graphTypes'
import { nextFreePosition, withPositions } from './layout'

let idCounter = 0
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${++idCounter}`

function toFlowNodes(def: WorkflowDef): BlockFlowNode[] {
  const positions = withPositions(def.nodes, def.edges)
  return def.nodes.map((node) => ({
    id: node.id,
    type: 'block' as const,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      blockType: node.type,
      label: node.label ?? CATALOG[node.type].displayName, // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: node.type is the BlockType union, not user input
      config: { ...node.config },
      status: null,
      invalid: false,
    },
  }))
}

function toFlowEdges(def: WorkflowDef): BlockFlowEdge[] {
  return def.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    type: EDGE_TYPE,
  }))
}

export interface WorkflowGraph {
  nodes: BlockFlowNode[]
  edges: BlockFlowEdge[]
  onNodesChange: OnNodesChange<BlockFlowNode>
  onEdgesChange: OnEdgesChange<BlockFlowEdge>
  onConnect: (connection: Connection) => void
  /**
   * `ignoreEdgeId` is the edge currently being dragged by one end: React Flow
   * asks whether the *new* shape is legal, and the old edge must not count
   * against it (its own slot would otherwise block the move).
   */
  isValidConnection: (connection: Connection | Edge, ignoreEdgeId?: string | null) => boolean
  /** Remove one edge (the × button on a hovered/selected edge). */
  deleteEdge: (id: string) => void
  /** Move an edge end to a new port; returns false when the move is not allowed. */
  reconnect: (oldEdge: BlockFlowEdge, connection: Connection) => boolean
  /** The node's arrival pop has played - drop the flag so it never replays. */
  clearNodeFresh: (id: string) => void
  /** The wire has finished drawing itself in - drop the flag. */
  clearEdgeFresh: (id: string) => void

  selectedNodeId: string | null
  selectNode: (id: string | null) => void
  selectedNode: BlockFlowNode | null

  loadWorkflow: (def: WorkflowDef) => void
  addBlock: (type: BlockType, position?: XYPosition) => string
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void
  updateNodeLabel: (id: string, label: string) => void
  deleteNode: (id: string) => void
  toWorkflowDef: () => WorkflowDef

  /** Highlight the nodes named by a validation response. */
  setInvalidNodes: (ids: string[]) => void
  /** Seam for the run task: paint live step status onto the nodes. */
  setNodeStatuses: (statuses: Record<string, StepStatus | null>) => void
  clearNodeStatuses: () => void
}

export function useWorkflowGraph(): WorkflowGraph {
  const [nodes, setNodes, onNodesChange] = useNodesState<BlockFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<BlockFlowEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const meta = useRef<{ id: string; name: string }>({ id: 'workflow', name: 'Untitled workflow' })

  const loadWorkflow = useCallback(
    (def: WorkflowDef) => {
      meta.current = { id: def.id, name: def.name }
      setNodes(toFlowNodes(def))
      setEdges(toFlowEdges(def))
      setSelectedNodeId(null)
    },
    [setNodes, setEdges],
  )

  const addBlock = useCallback(
    (type: BlockType, position?: XYPosition) => {
      const id = nextId(type)
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        {
          id,
          type: 'block' as const,
          position: position ?? nextFreePosition(current),
          selected: true,
          data: {
            blockType: type,
            label: CATALOG[type].displayName, // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
            config: defaultConfig(type),
            status: null,
            invalid: false,
            // Only user-added cards pop in; `toFlowNodes` never sets this.
            fresh: true,
          },
        },
      ])
      setSelectedNodeId(id)
      return id
    },
    [setNodes],
  )

  const patchData = useCallback(
    (id: string, patch: Partial<BlockFlowNode['data']>) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
      )
    },
    [setNodes],
  )

  const updateNodeConfig = useCallback(
    (id: string, config: Record<string, unknown>) => patchData(id, { config }),
    [patchData],
  )

  const updateNodeLabel = useCallback(
    (id: string, label: string) => patchData(id, { label }),
    [patchData],
  )

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((current) => current.filter((node) => node.id !== id))
      setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id))
      setSelectedNodeId((current) => (current === id ? null : current))
    },
    [setNodes, setEdges],
  )

  /**
   * Connection rules: nothing flows into an Input, nothing flows out of an
   * Output or Safe Stop, and only a Condition may have more than one next
   * step (one per branch).
   */
  const isValidAgainst = useCallback(
    (connection: Connection | Edge, existing: BlockFlowEdge[]): boolean => {
      const { source, target } = connection
      const sourceHandle = connection.sourceHandle ?? null
      if (!source || !target || source === target) return false

      const sourceNode = nodes.find((node) => node.id === source)
      const targetNode = nodes.find((node) => node.id === target)
      if (!sourceNode || !targetNode) return false

      if (!CATALOG[sourceNode.data.blockType].allowsOutgoing) return false // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: blockType is the BlockType union, not user input
      if (!CATALOG[targetNode.data.blockType].allowsIncoming) return false // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: blockType is the BlockType union, not user input

      const duplicate = existing.some(
        (edge) =>
          edge.source === source &&
          edge.target === target &&
          (edge.sourceHandle ?? null) === sourceHandle,
      )
      if (duplicate) return false

      const outgoing = existing.filter((edge) => edge.source === source)
      if (sourceNode.data.blockType === 'condition') {
        return !outgoing.some((edge) => (edge.sourceHandle ?? null) === sourceHandle)
      }
      return outgoing.length === 0
    },
    [nodes],
  )

  const isValidConnection = useCallback(
    (connection: Connection | Edge, ignoreEdgeId: string | null = null): boolean =>
      isValidAgainst(
        connection,
        ignoreEdgeId === null ? edges : edges.filter((edge) => edge.id !== ignoreEdgeId),
      ),
    [isValidAgainst, edges],
  )

  const deleteEdge = useCallback(
    (id: string) => setEdges((current) => current.filter((edge) => edge.id !== id)),
    [setEdges],
  )

  /**
   * Entry animations are one-shot: the element plays the keyframes, then tells
   * the graph to drop the flag so a later re-render cannot replay them.
   */
  const clearNodeFresh = useCallback(
    (id: string) =>
      setNodes((current) =>
        current.map((node) =>
          node.id === id && node.data.fresh
            ? { ...node, data: { ...node.data, fresh: false } }
            : node,
        ),
      ),
    [setNodes],
  )

  const clearEdgeFresh = useCallback(
    (id: string) =>
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id && edge.data?.fresh
            ? { ...edge, data: { ...edge.data, fresh: false } }
            : edge,
        ),
      ),
    [setEdges],
  )

  const reconnect = useCallback(
    (oldEdge: BlockFlowEdge, connection: Connection): boolean => {
      // Validate as if the old edge were already gone, or its own slot blocks it.
      const without = edges.filter((edge) => edge.id !== oldEdge.id)
      if (!isValidAgainst(connection, without)) return false
      setEdges((current) =>
        current.map((edge) =>
          edge.id === oldEdge.id
            ? {
                ...edge,
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
                // Re-routed by hand, so it re-draws along its new course.
                data: { ...edge.data, fresh: true },
              }
            : edge,
        ),
      )
      return true
    },
    [edges, isValidAgainst, setEdges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return
      setEdges((current) =>
        addEdge(
          { ...connection, id: nextId('e'), type: EDGE_TYPE, data: { fresh: true } },
          current,
        ),
      )
    },
    [isValidConnection, setEdges],
  )

  const toWorkflowDef = useCallback((): WorkflowDef => {
    const nodeDefs: NodeDef[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.blockType,
      label: node.data.label,
      config: node.data.config,
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    }))
    const edgeDefs: EdgeDef[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle === 'true' || edge.sourceHandle === 'false' ? edge.sourceHandle : null,
    }))
    return { id: meta.current.id, name: meta.current.name, nodes: nodeDefs, edges: edgeDefs }
  }, [nodes, edges])

  const setInvalidNodes = useCallback(
    (ids: string[]) => {
      const flagged = new Set(ids)
      setNodes((current) =>
        current.map((node) =>
          node.data.invalid === flagged.has(node.id)
            ? node
            : { ...node, data: { ...node.data, invalid: flagged.has(node.id) } },
        ),
      )
    },
    [setNodes],
  )

  const setNodeStatuses = useCallback(
    (statuses: Record<string, StepStatus | null>) => {
      setNodes((current) =>
        current.map((node) => {
          const status = statuses[node.id] ?? null // nosemgrep: gitlab.eslint.detect-object-injection -- read-only lookup of a node id this app generated, into a plain status map; a miss yields null
          return node.data.status === status ? node : { ...node, data: { ...node.data, status } }
        }),
      )
    },
    [setNodes],
  )

  const clearNodeStatuses = useCallback(() => setNodeStatuses({}), [setNodeStatuses])

  const selectNode = useCallback(
    (id: string | null) => {
      setSelectedNodeId(id)
      setNodes((current) =>
        current.map((node) => (node.selected === (node.id === id) ? node : { ...node, selected: node.id === id })),
      )
    },
    [setNodes],
  )

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    deleteEdge,
    reconnect,
    clearNodeFresh,
    clearEdgeFresh,
    selectedNodeId,
    selectNode,
    selectedNode,
    loadWorkflow,
    addBlock,
    updateNodeConfig,
    updateNodeLabel,
    deleteNode,
    toWorkflowDef,
    setInvalidNodes,
    setNodeStatuses,
    clearNodeStatuses,
  }
}
