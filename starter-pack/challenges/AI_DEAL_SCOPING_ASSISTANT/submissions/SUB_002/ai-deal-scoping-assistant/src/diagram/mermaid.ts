/**
 * Mermaid `flowchart TB` text for a `DiagramModel`: one subgraph per tier, sanitised node ids and
 * labels, and edge labels. Built by hand (no Mermaid runtime dependency) purely from
 * the domain model, independent of `layoutDiagram`'s pixel coordinates.
 */
import type { DiagramEdgeKind, DiagramModel } from '../domain';

const ID_PLACEHOLDER = 'n';

/** Mermaid ids allow only letters, digits and underscores, and must not start with a digit. */
function sanitizeMermaidId(rawId: string, usedIds: Set<string>): string {
  const cleaned = rawId.replace(/[^A-Za-z0-9_]/g, '_');
  const based = cleaned.length === 0 ? ID_PLACEHOLDER : cleaned;
  const safe = /^[0-9]/.test(based) ? `id_${based}` : based;
  let candidate = safe;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${safe}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

/** Strips characters that break Mermaid's `["..."]` node-label syntax and collapses whitespace. */
function sanitizeMermaidLabel(rawLabel: string): string {
  return rawLabel
    .replace(/["[\]{}|`\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARROW_BY_KIND: ReadonlyMap<DiagramEdgeKind, string> = new Map([
  ['request', '-->'],
  ['event', '-.->'],
  ['data', '-->'],
  ['batch', '==>'],
  ['auth', '-->'],
  ['telemetry', '-.->'],
]);

function arrowFor(kind: DiagramEdgeKind): string {
  return ARROW_BY_KIND.get(kind) ?? '-->';
}

interface NodeIds {
  byId: ReadonlyMap<string, string>;
}

function assignNodeIds(model: DiagramModel): NodeIds {
  const used = new Set<string>();
  const byId = new Map(model.nodes.map((node) => [node.id, sanitizeMermaidId(node.id, used)]));
  return { byId };
}

/** Internal nodes render as rectangles, external systems as stadium shapes, matching the SVG's dashed border. */
function nodeLine(node: DiagramModel['nodes'][number], mermaidId: string): string {
  const label = sanitizeMermaidLabel(node.label);
  const sublabel = sanitizeMermaidLabel(node.sublabel);
  const text = sublabel.length === 0 ? label : `${label}<br/>${sublabel}`;
  return node.external ? `    ${mermaidId}(["${text}"])` : `    ${mermaidId}["${text}"]`;
}

function renderSubgraph(tier: DiagramModel['tiers'][number], nodes: readonly DiagramModel['nodes'][number][], ids: NodeIds, used: Set<string>): string {
  const subgraphId = sanitizeMermaidId(`tier_${tier.id}`, used);
  const label = sanitizeMermaidLabel(tier.label);
  const lines = nodes.map((node) => nodeLine(node, ids.byId.get(node.id) ?? sanitizeMermaidId(node.id, used)));
  return [`  subgraph ${subgraphId}["${label}"]`, ...lines, '  end'].join('\n');
}

function renderEdgeLine(edge: DiagramModel['edges'][number], ids: NodeIds): string | null {
  const fromId = ids.byId.get(edge.from);
  const toId = ids.byId.get(edge.to);
  if (fromId === undefined || toId === undefined) {
    return null;
  }
  const arrow = arrowFor(edge.kind);
  const label = sanitizeMermaidLabel(edge.label);
  const arrowWithLabel = label.length === 0 ? arrow : `${arrow}|${label}|`;
  return `  ${fromId} ${arrowWithLabel} ${toId}`;
}

/**
 * `flowchart TB` text: one `subgraph` per tier (in model order) holding its nodes, followed by every
 * edge whose endpoints both resolve to a known node - an edge naming an unknown node id is skipped,
 * the same rule `layoutDiagram` applies. An empty model renders a flowchart with an explanatory
 * comment instead of a bare, confusing header.
 */
export function diagramToMermaid(model: DiagramModel): string {
  if (model.nodes.length === 0) {
    return 'flowchart TB\n  %% No diagram elements to display yet.';
  }
  const ids = assignNodeIds(model);
  const usedSubgraphIds = new Set<string>(ids.byId.values());
  const nodesByTier = new Map<string, DiagramModel['nodes']>();
  for (const node of model.nodes) {
    const bucket = nodesByTier.get(node.tierId) ?? [];
    bucket.push(node);
    nodesByTier.set(node.tierId, bucket);
  }

  const subgraphs = model.tiers
    .filter((tier) => (nodesByTier.get(tier.id) ?? []).length > 0)
    .map((tier) => renderSubgraph(tier, nodesByTier.get(tier.id) ?? [], ids, usedSubgraphIds));
  const edgeLines = model.edges.map((edge) => renderEdgeLine(edge, ids)).filter((line): line is string => line !== null);

  return ['flowchart TB', ...subgraphs, ...edgeLines].join('\n');
}
