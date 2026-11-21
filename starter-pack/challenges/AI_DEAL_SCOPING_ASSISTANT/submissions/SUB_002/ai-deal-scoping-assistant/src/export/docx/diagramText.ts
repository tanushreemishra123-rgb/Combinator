/**
 * Reads this project's own `diagramToMermaid` output (see src/diagram/mermaid.ts) back into plain
 * text: one tier with its node labels, and one line per flow. This is not a general Mermaid parser
 * - it only needs to understand the `flowchart TB` shape this project ever generates - and it is
 * what lets the DOCX export show a diagram as a titled list instead of an unreadable SVG.
 */

export interface MermaidTier {
  label: string;
  nodes: string[];
}

const SUBGRAPH_LINE = /^\s*subgraph\s+\S+\["(.*)"\]$/;
const END_LINE = /^\s*end\s*$/;
const RECTANGLE_NODE_LINE = /^\s*\S+\["(.*)"\]$/;
const STADIUM_NODE_LINE = /^\s*\S+\(\["(.*)"\]\)$/;
const EDGE_LINE = /^\s*(\S+)\s+(?:-->|-\.->|==>)(?:\|(.*?)\|)?\s+(\S+)$/;
const LINE_BREAK_TAG = /<br\/>/g;

function nodeLabel(line: string): string | null {
  const stadium = STADIUM_NODE_LINE.exec(line);
  if (stadium !== null) {
    return (stadium.at(1) ?? '').replace(LINE_BREAK_TAG, ' - ');
  }
  const rectangle = RECTANGLE_NODE_LINE.exec(line);
  return rectangle === null ? null : (rectangle.at(1) ?? '').replace(LINE_BREAK_TAG, ' - ');
}

/** One entry per tier (subgraph), in source order, with the human-readable label of every node in it. */
export function diagramTiers(mermaid: string): MermaidTier[] {
  const tiers: MermaidTier[] = [];
  let current: MermaidTier | null = null;
  for (const line of mermaid.split('\n')) {
    const subgraph = SUBGRAPH_LINE.exec(line);
    if (subgraph !== null) {
      current = { label: subgraph.at(1) ?? '', nodes: [] };
      tiers.push(current);
      continue;
    }
    if (END_LINE.test(line)) {
      current = null;
      continue;
    }
    if (current === null) {
      continue;
    }
    const label = nodeLabel(line);
    if (label !== null) {
      current.nodes.push(label);
    }
  }
  return tiers;
}

/** One line per edge: 'from -> to (label)', or 'from -> to' when the edge carries no label. */
export function diagramFlowLines(mermaid: string): string[] {
  const lines: string[] = [];
  for (const line of mermaid.split('\n')) {
    const match = EDGE_LINE.exec(line);
    if (match === null) {
      continue;
    }
    const from = match.at(1) ?? '';
    const label = match.at(2) ?? '';
    const to = match.at(3) ?? '';
    lines.push(label.length === 0 ? `${from} -> ${to}` : `${from} -> ${to} (${label})`);
  }
  return lines;
}
