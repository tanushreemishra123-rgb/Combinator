import { describe, expect, it } from 'vitest';
import { layoutDiagram } from './layout';
import type { LaidOutNode } from './layout';
import { DIAGRAM_PADDING, DIAGRAM_WIDTH, MAX_NODES_PER_ROW } from './constants';
import type { DiagramModel } from '../domain';

function node(id: string, tierId: string, overrides: Partial<DiagramModel['nodes'][number]> = {}): DiagramModel['nodes'][number] {
  return { id, label: id, sublabel: '', tierId, refs: [], external: false, ...overrides };
}

/** Finds a laid-out node by id and fails the test immediately (with a clear message) if it is missing. */
function requireNode(nodes: readonly LaidOutNode[], id: string): LaidOutNode {
  const found = nodes.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`expected layout to contain node "${id}"`);
  }
  return found;
}

/** True when no two boxes in `row` (assumed to share one y) overlap horizontally. */
function rowHasNoOverlap(row: readonly LaidOutNode[]): boolean {
  const sorted = [...row].sort((a, b) => a.x - b.x);
  return sorted.every((box, index) => {
    const previous = sorted.at(index - 1);
    return index === 0 || previous === undefined || box.x >= previous.x + previous.width;
  });
}

function baseModel(overrides: Partial<DiagramModel> = {}): DiagramModel {
  return {
    title: 'Test Diagram',
    tiers: [
      { id: 'tier-a', label: 'Tier A' },
      { id: 'tier-b', label: 'Tier B' },
    ],
    nodes: [node('n1', 'tier-a'), node('n2', 'tier-b')],
    edges: [{ from: 'n1', to: 'n2', label: 'calls', kind: 'request' }],
    ...overrides,
  };
}

describe('layoutDiagram - empty and degenerate models', () => {
  it('handles a fully empty model without throwing', () => {
    const layout = layoutDiagram({ title: 'Empty', tiers: [], nodes: [], edges: [] });
    expect(layout.tiers).toEqual([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(DIAGRAM_WIDTH);
    expect(layout.height).toBe(DIAGRAM_PADDING * 2);
  });

  it('drops nodes whose tierId does not match any tier in the model', () => {
    const model = baseModel({ nodes: [node('n1', 'tier-a'), node('ghost', 'unknown-tier')] });
    const layout = layoutDiagram(model);
    expect(layout.nodes.map((n) => n.id)).toEqual(['n1']);
  });

  it('skips edges that reference an unknown node id instead of throwing', () => {
    const model = baseModel({ edges: [{ from: 'n1', to: 'missing', label: '', kind: 'request' }] });
    const layout = layoutDiagram(model);
    expect(layout.edges).toEqual([]);
  });

  it('still renders a band for a tier that has zero nodes', () => {
    const model = baseModel({ tiers: [{ id: 'tier-a', label: 'Tier A' }, { id: 'tier-empty', label: 'Empty Tier' }], nodes: [node('n1', 'tier-a')], edges: [] });
    const layout = layoutDiagram(model);
    expect(layout.tiers).toHaveLength(2);
    expect(layout.tiers.at(1)?.height).toBeGreaterThan(0);
  });
});

describe('layoutDiagram - determinism and no overlap', () => {
  it('produces byte-identical output for the same input', () => {
    const model = baseModel();
    expect(layoutDiagram(model)).toEqual(layoutDiagram(model));
  });

  it('wraps a tier with more than MAX_NODES_PER_ROW nodes into additional rows', () => {
    const many = Array.from({ length: MAX_NODES_PER_ROW + 2 }, (_, index) => node(`n${index}`, 'tier-a'));
    const model = baseModel({ nodes: many, edges: [] });
    const layout = layoutDiagram(model);
    const rowYs = new Set(layout.nodes.map((n) => n.y));
    expect(rowYs.size).toBe(2);
  });

  it('never overlaps two node boxes within the same tier row', () => {
    const many = Array.from({ length: MAX_NODES_PER_ROW + 2 }, (_, index) => node(`n${index}`, 'tier-a'));
    const model = baseModel({ nodes: many, edges: [] });
    const layout = layoutDiagram(model);
    const byRow = new Map<number, LaidOutNode[]>();
    for (const laidOutNode of layout.nodes) {
      const row = byRow.get(laidOutNode.y) ?? [];
      row.push(laidOutNode);
      byRow.set(laidOutNode.y, row);
    }
    for (const row of byRow.values()) {
      expect(rowHasNoOverlap(row)).toBe(true);
    }
  });
});

describe('layoutDiagram - edge anchors', () => {
  it('anchors a cross-tier edge top/bottom in the direction of travel', () => {
    const layout = layoutDiagram(baseModel());
    const edge = layout.edges.at(0);
    expect(edge).toBeDefined();
    const from = requireNode(layout.nodes, 'n1');
    const to = requireNode(layout.nodes, 'n2');
    // n1 is in the earlier tier (tier-a), n2 in the later tier (tier-b): the path should start at
    // n1's bottom edge and end at n2's top edge.
    const expectedStart = `M ${from.x + from.width / 2} ${from.y + from.height}`;
    const expectedEnd = `${to.x + to.width / 2} ${to.y}`;
    expect(edge?.path.startsWith(expectedStart)).toBe(true);
    expect(edge?.path.endsWith(expectedEnd)).toBe(true);
  });

  it('anchors a same-tier edge on the left/right sides', () => {
    const model = baseModel({
      tiers: [{ id: 'tier-a', label: 'Tier A' }],
      nodes: [node('left', 'tier-a'), node('right', 'tier-a')],
      edges: [{ from: 'left', to: 'right', label: 'peer', kind: 'data' }],
    });
    const layout = layoutDiagram(model);
    const edge = layout.edges.at(0);
    expect(edge).toBeDefined();
    const left = requireNode(layout.nodes, 'left');
    const right = requireNode(layout.nodes, 'right');
    // Side anchors: the path's y coordinates equal both boxes' vertical centers (same row => equal).
    const centerY = left.y + left.height / 2;
    const expectedEnd = `${right.x} ${centerY}`;
    expect(edge?.path.includes(`${centerY}`)).toBe(true);
    expect(edge?.path.endsWith(expectedEnd)).toBe(true);
  });

  it('places the edge label at the midpoint of its anchors', () => {
    const layout = layoutDiagram(baseModel());
    const edge = layout.edges.at(0);
    expect(edge).toBeDefined();
    const from = requireNode(layout.nodes, 'n1');
    const to = requireNode(layout.nodes, 'n2');
    const expectedX = (from.x + from.width / 2 + (to.x + to.width / 2)) / 2;
    expect(edge?.labelX).toBe(expectedX);
  });
});
