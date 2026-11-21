/** Canvas-side node/edge types and the palette drag payload. */

import type { Edge, Node } from '@xyflow/react'
import type { BlockType, StepStatus } from '../api/types'

export type BlockNodeData = {
  blockType: BlockType
  label: string
  config: Record<string, unknown>
  /** Live run status - populated by the run task, `null` in the builder. */
  status: StepStatus | null
  /** Set by "Check workflow" so offending nodes light up. */
  invalid: boolean
  /**
   * Just added by the user, so the card plays its arrival pop once. Cleared by
   * the node itself on `animationend`; nodes from a loaded puzzle never set it,
   * which is what keeps a freshly loaded canvas still.
   */
  fresh?: boolean
}

export type BlockFlowNode = Node<BlockNodeData, 'block'>

export type BlockFlowEdgeData = {
  /** Just connected by the user, so the wire draws itself in once. */
  fresh?: boolean
  /** The edge feeds the step currently in flight - it carries the signal dot. */
  active?: boolean
  /** Pointer is over the edge, so the × remove button shows. */
  hovered?: boolean
  /** A run owns the canvas: no × button, no lift. */
  locked?: boolean
  /** Called by the edge once its draw-in has finished, to clear `fresh`. */
  onDrawn?: (id: string) => void
}

export type BlockFlowEdge = Edge<BlockFlowEdgeData>

/** The one edge renderer: a smoothstep path that stops short of the target port. */
export const EDGE_TYPE = 'flow'

/** MIME type used to carry a block type from the palette to the canvas. */
export const BLOCK_DRAG_TYPE = 'application/x-workflow-block'
