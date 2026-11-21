/**
 * Canvas positioning for a freshly-loaded workflow.
 *
 * `NodeDef.position` is canvas-only - the engine ignores it - so a starter
 * workflow's coordinates are only ever a hint, authored against whatever canvas
 * the author had in mind. (The seeded puzzles run left-to-right at 240px steps,
 * which collides with 252px-wide nodes and with the top/bottom connection
 * ports.) Normalising on load means the mock and the real backend produce the
 * same readable top-down pipeline; from then on the user's own drags are what
 * count, and those round-trip through `toWorkflowDef()`.
 */

import type { EdgeDef, NodeDef } from '../api/types'

/**
 * The gaps are sized for the node card: `NODE_WIDTH` across, and up to ~135px
 * tall once it carries a header, a label, three config rows and a guard footer.
 */
export const NODE_WIDTH = 252
export const COLUMN_X = 220
export const COLUMN_GAP = 320
export const ROW_GAP = 168

/** Order nodes by walking forward from the input block; leftovers keep their original order. */
export function executionOrder(nodes: NodeDef[], edges: EdgeDef[]): NodeDef[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const nextOf = new Map<string, string[]>()
  for (const edge of edges) {
    nextOf.set(edge.source, [...(nextOf.get(edge.source) ?? []), edge.target])
  }

  const start = nodes.find((node) => node.type === 'input') ?? nodes[0]
  const ordered: NodeDef[] = []
  const seen = new Set<string>()

  const walk = (id: string): void => {
    if (seen.has(id)) return
    const node = byId.get(id)
    if (!node) return
    seen.add(id)
    ordered.push(node)
    for (const next of nextOf.get(id) ?? []) walk(next)
  }

  if (start) walk(start.id)
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      seen.add(node.id)
      ordered.push(node)
    }
  }
  return ordered
}

/**
 * One top-down column per branch: the main path stays in lane 0, and anything
 * reached through a condition's `false` handle moves one lane to the right so
 * the two paths never sit on top of each other.
 */
export function withPositions(nodes: NodeDef[], edges: EdgeDef[]): Map<string, { x: number; y: number }> {
  const lanes = new Map<string, number>()
  for (const edge of edges) {
    if (edge.sourceHandle === 'false') lanes.set(edge.target, 1)
  }
  // A branch's lane carries down the rest of that branch.
  const nextOf = new Map<string, EdgeDef[]>()
  for (const edge of edges) nextOf.set(edge.source, [...(nextOf.get(edge.source) ?? []), edge])

  const spread = (id: string, lane: number, seen: Set<string>): void => {
    if (seen.has(id)) return
    seen.add(id)
    lanes.set(id, Math.max(lanes.get(id) ?? 0, lane))
    for (const edge of nextOf.get(id) ?? []) {
      spread(edge.target, edge.sourceHandle === 'false' ? 1 : lane, seen)
    }
  }
  for (const [id, lane] of [...lanes]) spread(id, lane, new Set())

  const positions = new Map<string, { x: number; y: number }>()
  for (const [row, node] of executionOrder(nodes, edges).entries()) {
    positions.set(node.id, {
      x: COLUMN_X + (lanes.get(node.id) ?? 0) * COLUMN_GAP,
      y: row * ROW_GAP,
    })
  }
  return positions
}

/** Where a click-to-add block should land: below the lowest existing node. */
export function nextFreePosition(existing: { position: { x: number; y: number } }[]): {
  x: number
  y: number
} {
  if (existing.length === 0) return { x: COLUMN_X, y: 0 }
  const lowest = existing.reduce((best, node) => (node.position.y > best.position.y ? node : best))
  return { x: lowest.position.x, y: lowest.position.y + ROW_GAP }
}
