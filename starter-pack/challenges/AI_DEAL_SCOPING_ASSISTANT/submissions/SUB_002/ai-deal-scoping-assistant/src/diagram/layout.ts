/**
 * Single layout algorithm shared by the React SVG renderer (`src/ui/diagram`) and the exported SVG
 * string (`svg.ts`): horizontal tier bands stacked top-to-bottom with a label gutter on the left,
 * each tier's nodes flowing left-to-right and wrapping into additional rows once it holds more than
 * `MAX_NODES_PER_ROW`. Every size comes from the documented constants, never from measured text, so
 * the same `DiagramModel` always produces byte-identical coordinates.
 */
import {
  DIAGRAM_PADDING,
  DIAGRAM_WIDTH,
  MAX_NODES_PER_ROW,
  NODE_GAP_X,
  NODE_GAP_Y,
  NODE_HEIGHT,
  NODE_WIDTH,
  TIER_BAND_GAP,
  TIER_BAND_PADDING_Y,
  TIER_LABEL_GUTTER_WIDTH,
} from './constants';
import type { DiagramEdge, DiagramEdgeKind, DiagramModel, DiagramNode, DiagramTier } from '../domain';

export interface LaidOutNode {
  id: string;
  label: string;
  sublabel: string;
  refs: string[];
  external: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutTier {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutEdge {
  from: string;
  to: string;
  label: string;
  kind: DiagramEdgeKind;
  /** SVG path data connecting the two node boxes. */
  path: string;
  labelX: number;
  labelY: number;
}

export interface DiagramLayout {
  title: string;
  width: number;
  height: number;
  tiers: LaidOutTier[];
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

export { wrapLabel } from './wrap';

/** Splits `items` into fixed-size rows, preserving order (the last row may be shorter). */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    rows.push(items.slice(start, start + size));
  }
  return rows;
}

/** Groups nodes by tier id, keeping only nodes whose `tierId` matches a tier in the model - a node
 * pointing at an unrecognised tier is silently omitted, mirroring how unknown edge endpoints are
 * skipped rather than crashing the layout. */
function groupNodesByTier(nodes: readonly DiagramNode[], tierIds: ReadonlySet<string>): Map<string, DiagramNode[]> {
  const groups = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    if (!tierIds.has(node.tierId)) {
      continue;
    }
    const bucket = groups.get(node.tierId) ?? [];
    bucket.push(node);
    groups.set(node.tierId, bucket);
  }
  return groups;
}

interface TierLayoutResult {
  band: LaidOutTier;
  nodes: LaidOutNode[];
}

/** Lays out one tier's rows of nodes starting at vertical offset `top`, and sizes its band to fit them. */
function layoutTierBand(tier: DiagramTier, tierNodes: readonly DiagramNode[], top: number): TierLayoutResult {
  const rows = chunk(tierNodes, MAX_NODES_PER_ROW);
  const rowCount = Math.max(1, rows.length);
  const height = TIER_BAND_PADDING_Y * 2 + rowCount * NODE_HEIGHT + (rowCount - 1) * NODE_GAP_Y;

  const nodes: LaidOutNode[] = rows.flatMap((row, rowIndex) =>
    row.map((node, columnIndex) => ({
      id: node.id,
      label: node.label,
      sublabel: node.sublabel,
      refs: [...node.refs],
      external: node.external,
      x: DIAGRAM_PADDING + TIER_LABEL_GUTTER_WIDTH + columnIndex * (NODE_WIDTH + NODE_GAP_X),
      y: top + TIER_BAND_PADDING_Y + rowIndex * (NODE_HEIGHT + NODE_GAP_Y),
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
  );

  const band: LaidOutTier = { id: tier.id, label: tier.label, x: DIAGRAM_PADDING, y: top, width: DIAGRAM_WIDTH - DIAGRAM_PADDING * 2, height };
  return { band, nodes };
}

interface TieredLayout {
  tiers: LaidOutTier[];
  nodes: LaidOutNode[];
  height: number;
}

/** Stacks every tier band top-to-bottom, each sized to the rows its own nodes need. */
function layoutTiers(model: DiagramModel): TieredLayout {
  const tierIds = new Set(model.tiers.map((tier) => tier.id));
  const nodesByTier = groupNodesByTier(model.nodes, tierIds);

  const tiers: LaidOutTier[] = [];
  const nodes: LaidOutNode[] = [];
  let cursorY = DIAGRAM_PADDING;
  for (const tier of model.tiers) {
    const result = layoutTierBand(tier, nodesByTier.get(tier.id) ?? [], cursorY);
    tiers.push(result.band);
    nodes.push(...result.nodes);
    cursorY += result.band.height + TIER_BAND_GAP;
  }
  const height = model.tiers.length === 0 ? DIAGRAM_PADDING * 2 : cursorY - TIER_BAND_GAP + DIAGRAM_PADDING;
  return { tiers, nodes, height };
}

/** Node id -> the index of the tier it was actually placed in (only known-tier nodes are present). */
function nodeTierIndex(model: DiagramModel): Map<string, number> {
  const tierIndexById = new Map(model.tiers.map((tier, index) => [tier.id, index]));
  const result = new Map<string, number>();
  for (const node of model.nodes) {
    const index = tierIndexById.get(node.tierId);
    if (index !== undefined) {
      result.set(node.id, index);
    }
  }
  return result;
}

interface AnchorPair {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  vertical: boolean;
}

/** Picks top/bottom anchors when the nodes sit in different tiers, or side anchors within one tier. */
function anchorsFor(from: LaidOutNode, to: LaidOutNode, fromTier: number, toTier: number): AnchorPair {
  if (fromTier === toTier) {
    const fromRightToLeft = to.x >= from.x;
    const fromX = fromRightToLeft ? from.x + from.width : from.x;
    const toX = fromRightToLeft ? to.x : to.x + to.width;
    return { fromX, fromY: from.y + from.height / 2, toX, toY: to.y + to.height / 2, vertical: false };
  }
  const downward = fromTier < toTier;
  const fromY = downward ? from.y + from.height : from.y;
  const toY = downward ? to.y : to.y + to.height;
  return { fromX: from.x + from.width / 2, fromY, toX: to.x + to.width / 2, toY, vertical: true };
}

/** Smooth cubic-bezier path between two anchors: an S-curve along whichever axis they differ on. */
function smoothPath(anchors: AnchorPair): string {
  const { fromX, fromY, toX, toY, vertical } = anchors;
  if (vertical) {
    const midY = fromY + (toY - fromY) / 2;
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  }
  const midX = fromX + (toX - fromX) / 2;
  return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
}

/** Builds edge paths between laid-out node boxes; edges naming an id absent from `model.nodes` are skipped. */
function layoutEdges(edges: readonly DiagramEdge[], nodeById: ReadonlyMap<string, LaidOutNode>, tierByNode: ReadonlyMap<string, number>): LaidOutEdge[] {
  const laidOut: LaidOutEdge[] = [];
  for (const edge of edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    const fromTier = tierByNode.get(edge.from);
    const toTier = tierByNode.get(edge.to);
    if (from === undefined || to === undefined || fromTier === undefined || toTier === undefined) {
      continue;
    }
    const anchors = anchorsFor(from, to, fromTier, toTier);
    laidOut.push({
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind,
      path: smoothPath(anchors),
      labelX: (anchors.fromX + anchors.toX) / 2,
      labelY: (anchors.fromY + anchors.toY) / 2,
    });
  }
  return laidOut;
}

/**
 * Lays out a diagram model deterministically: same input always yields identical coordinates, so the
 * result can be diffed, snapshotted and rendered identically by both the app and the exporters. An
 * empty model (no tiers) yields an empty, minimally-sized layout instead of throwing.
 */
export function layoutDiagram(model: DiagramModel): DiagramLayout {
  const { tiers, nodes, height } = layoutTiers(model);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const tierByNode = nodeTierIndex(model);
  const edges = layoutEdges(model.edges, nodeById, tierByNode);
  return { title: model.title, width: DIAGRAM_WIDTH, height, tiers, nodes, edges };
}
