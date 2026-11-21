/**
 * Standalone, escaped SVG markup for a `DiagramModel`, built as a plain string for the downloadable
 * HTML/Markdown export (never injected into this app's DOM). Reuses `layoutDiagram` for every
 * coordinate, so the exported picture always matches the in-app view of the same model. Every tag
 * is assembled with the shared `src/markup` builder, which escapes text and attribute values by
 * construction.
 */
import { layoutDiagram } from './layout';
import type { DiagramLayout, LaidOutEdge, LaidOutNode, LaidOutTier } from './layout';
import {
  EDGE_LABEL_FONT_SIZE,
  EDGE_LABEL_MAX_CHARS,
  NODE_LABEL_FONT_SIZE,
  NODE_LABEL_LINE_HEIGHT,
  NODE_LABEL_MAX_CHARS,
  NODE_LABEL_MAX_LINES,
  NODE_REFS_FONT_SIZE,
  NODE_REFS_MAX_CHARS,
  NODE_SUBLABEL_FONT_SIZE,
  NODE_SUBLABEL_MAX_CHARS,
  TIER_LABEL_FONT_SIZE,
  TIER_LABEL_MAX_CHARS,
  TITLE_BAR_HEIGHT,
  TITLE_FONT_SIZE,
} from './constants';
import { truncateText, wrapLabelToLines } from './wrap';
import { element, escapeAttribute, text, voidElement } from '../markup';
import type { Attribute } from '../markup';
import type { DiagramEdgeKind, DiagramModel } from '../domain';

/** The one escaping path every piece of attribute/text content in this file's output goes through.
 * Kept as a named export for the small number of existing call sites and tests written against it. */
export const escapeXml = escapeAttribute;

interface EdgeStyle {
  color: string;
  dash: string | null;
  noun: string;
}

const EDGE_KIND_STYLE: ReadonlyMap<DiagramEdgeKind, EdgeStyle> = new Map([
  ['request', { color: '#2563eb', dash: null, noun: 'Request' }],
  ['event', { color: '#7c3aed', dash: '4,3', noun: 'Event' }],
  ['data', { color: '#0f766e', dash: null, noun: 'Data' }],
  ['batch', { color: '#b45309', dash: '3,3', noun: 'Batch' }],
  ['auth', { color: '#be123c', dash: null, noun: 'Auth' }],
  ['telemetry', { color: '#64748b', dash: '1,3', noun: 'Telemetry' }],
]);

function edgeStyle(kind: DiagramEdgeKind): EdgeStyle {
  return EDGE_KIND_STYLE.get(kind) ?? { color: '#334155', dash: null, noun: 'Flow' };
}

function markerId(kind: DiagramEdgeKind): string {
  return `arrow-${kind}`;
}

function markerXml(kind: DiagramEdgeKind, style: EdgeStyle): string {
  const arrowhead = voidElement('path', [
    ['d', 'M0,0 L10,5 L0,10 z'],
    ['fill', style.color],
  ]);
  const attributes: Attribute[] = [
    ['id', markerId(kind)],
    ['viewBox', '0 0 10 10'],
    ['refX', 8],
    ['refY', 5],
    ['markerWidth', 8],
    ['markerHeight', 8],
    ['orient', 'auto-start-reverse'],
  ];
  return element('marker', attributes, arrowhead);
}

/** One arrowhead marker per edge kind, referenced by `marker-end` on that kind's paths. */
function renderDefs(): string {
  const markers = [...EDGE_KIND_STYLE.entries()]
    .map(([kind, style]) => markerXml(kind, style))
    .join('');
  return element('defs', [], markers);
}

function renderTspans(lines: readonly string[], x: number, startY: number, lineHeight: number): string {
  return lines
    .map((line, index) =>
      element(
        'tspan',
        [
          ['x', x],
          ['y', startY + index * lineHeight],
        ],
        text(line),
      ),
    )
    .join('');
}

function renderTierBand(tier: LaidOutTier): string {
  const rect = voidElement('rect', [
    ['x', tier.x],
    ['y', tier.y],
    ['width', tier.width],
    ['height', tier.height],
    ['class', 'tier-band'],
  ]);
  const labelLines = wrapLabelToLines(tier.label, TIER_LABEL_MAX_CHARS, 3);
  const labelX = tier.x + 10;
  const textY = tier.y + tier.height / 2 - ((labelLines.length - 1) * TIER_LABEL_FONT_SIZE) / 2;
  const label = element(
    'text',
    [
      ['x', labelX],
      ['y', textY],
      ['class', 'tier-label'],
      ['font-size', TIER_LABEL_FONT_SIZE],
    ],
    renderTspans(labelLines, labelX, textY, TIER_LABEL_FONT_SIZE + 2),
  );
  return rect + label;
}

/** The "Refs: FR_01, FR_02" line under a node, or an explicit statement when it cites nothing. */
function refsLine(refs: readonly string[]): string {
  return refs.length === 0 ? 'No linked requirements' : `Refs: ${refs.join(', ')}`;
}

function renderNodeBox(node: LaidOutNode): string {
  const className = node.external ? 'node-box node-external' : 'node-box';
  return voidElement('rect', [
    ['x', node.x],
    ['y', node.y],
    ['width', node.width],
    ['height', node.height],
    ['rx', 6],
    ['class', className],
    ['stroke-dasharray', node.external ? '6,4' : undefined],
  ]);
}

function renderNodeLabel(labelLines: readonly string[], labelX: number, labelStartY: number): string {
  const attributes: Attribute[] = [
    ['x', labelX],
    ['y', labelStartY],
    ['text-anchor', 'middle'],
    ['class', 'node-label'],
    ['font-size', NODE_LABEL_FONT_SIZE],
  ];
  return element('text', attributes, renderTspans(labelLines, labelX, labelStartY, NODE_LABEL_LINE_HEIGHT));
}

function renderNode(node: LaidOutNode): string {
  const labelX = node.x + node.width / 2;
  const labelStartY = node.y + 18;
  const labelLines = wrapLabelToLines(node.label, NODE_LABEL_MAX_CHARS, NODE_LABEL_MAX_LINES);

  const rect = renderNodeBox(node);
  const labelText = renderNodeLabel(labelLines, labelX, labelStartY);

  const sublabelY = labelStartY + labelLines.length * NODE_LABEL_LINE_HEIGHT + 4;
  const sublabel =
    node.sublabel.trim().length === 0
      ? ''
      : element(
          'text',
          [
            ['x', labelX],
            ['y', sublabelY],
            ['text-anchor', 'middle'],
            ['class', 'node-sublabel'],
            ['font-size', NODE_SUBLABEL_FONT_SIZE],
          ],
          text(truncateText(node.sublabel, NODE_SUBLABEL_MAX_CHARS)),
        );

  const refsY = node.y + node.height - 8;
  const refs = element(
    'text',
    [
      ['x', labelX],
      ['y', refsY],
      ['text-anchor', 'middle'],
      ['class', 'node-refs'],
      ['font-size', NODE_REFS_FONT_SIZE],
    ],
    text(truncateText(refsLine(node.refs), NODE_REFS_MAX_CHARS)),
  );

  return rect + labelText + sublabel + refs;
}

function renderEdgePath(edge: LaidOutEdge, style: EdgeStyle): string {
  return voidElement('path', [
    ['d', edge.path],
    ['fill', 'none'],
    ['stroke', style.color],
    ['stroke-width', 1.5],
    ['stroke-dasharray', style.dash ?? undefined],
    ['marker-end', `url(#${markerId(edge.kind)})`],
  ]);
}

function renderEdge(edge: LaidOutEdge): string {
  const style = edgeStyle(edge.kind);
  const path = renderEdgePath(edge, style);

  const labelSource = edge.label.trim().length === 0 ? style.noun : edge.label;
  const label = truncateText(labelSource, EDGE_LABEL_MAX_CHARS);
  const labelWidth = label.length * (EDGE_LABEL_FONT_SIZE * 0.62) + 8;

  const badge = voidElement('rect', [
    ['x', edge.labelX - labelWidth / 2],
    ['y', edge.labelY - EDGE_LABEL_FONT_SIZE],
    ['width', labelWidth],
    ['height', EDGE_LABEL_FONT_SIZE + 4],
    ['class', 'edge-label-bg'],
    ['rx', 3],
  ]);
  const labelText = element(
    'text',
    [
      ['x', edge.labelX],
      ['y', edge.labelY - 2],
      ['text-anchor', 'middle'],
      ['class', 'edge-label'],
      ['font-size', EDGE_LABEL_FONT_SIZE],
    ],
    text(label),
  );
  return path + badge + labelText;
}

const SVG_STYLE_RULES =
  '.tier-band{fill:#f8fafc;stroke:#cbd5e1;stroke-width:1;}' +
  '.tier-label{fill:#334155;font-family:Arial,Helvetica,sans-serif;font-weight:600;}' +
  '.node-box{fill:#ffffff;stroke:#1d4ed8;stroke-width:1.25;}' +
  '.node-external{stroke:#64748b;}' +
  '.node-label{fill:#0f172a;font-family:Arial,Helvetica,sans-serif;font-weight:600;}' +
  '.node-sublabel{fill:#475569;font-family:Arial,Helvetica,sans-serif;}' +
  '.node-refs{fill:#64748b;font-family:Arial,Helvetica,sans-serif;}' +
  '.edge-label-bg{fill:#ffffff;stroke:#e2e8f0;stroke-width:1;}' +
  '.edge-label{fill:#1e293b;font-family:Arial,Helvetica,sans-serif;}' +
  '.diagram-title{fill:#0f172a;font-family:Arial,Helvetica,sans-serif;font-weight:700;}';

const SVG_STYLE = element('style', [], SVG_STYLE_RULES);

function renderTitle(title: string): string {
  return element(
    'text',
    [
      ['x', TITLE_BAR_HEIGHT / 2],
      ['y', TITLE_BAR_HEIGHT / 2 + 4],
      ['class', 'diagram-title'],
      ['font-size', TITLE_FONT_SIZE],
    ],
    text(title),
  );
}

function renderBody(layout: DiagramLayout): string {
  const tiers = layout.tiers.map(renderTierBand).join('');
  const nodes = layout.nodes.map(renderNode).join('');
  const edges = layout.edges.map(renderEdge).join('');
  return element('g', [['transform', `translate(0, ${TITLE_BAR_HEIGHT})`]], tiers, edges, nodes);
}

/**
 * Standalone SVG document for one diagram model: tier bands, node boxes (external nodes dashed),
 * a requirement-refs line under each node, arrow markers per edge kind and a title, all built from
 * `layoutDiagram`'s deterministic coordinates.
 */
export function diagramToSvg(model: DiagramModel): string {
  const layout = layoutDiagram(model);
  const height = layout.height + TITLE_BAR_HEIGHT;
  const titleEl = element('title', [], text(layout.title));
  const body = [titleEl, SVG_STYLE, renderDefs(), renderTitle(layout.title), renderBody(layout)].join('');
  const attributes: Attribute[] = [
    ['xmlns', 'http://www.w3.org/2000/svg'],
    ['viewBox', `0 0 ${layout.width} ${height}`],
    ['width', layout.width],
    ['height', height],
    ['role', 'img'],
    ['aria-label', layout.title],
  ];
  return element('svg', attributes, body);
}
