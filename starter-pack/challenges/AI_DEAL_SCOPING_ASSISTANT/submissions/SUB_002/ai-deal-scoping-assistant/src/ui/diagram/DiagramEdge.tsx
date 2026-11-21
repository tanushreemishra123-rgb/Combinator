/** One flow: its path with an arrowhead, and a label badge at the path's midpoint. */
import type { ReactElement } from 'react';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_CHARS, truncateText } from '../../diagram';
import type { LaidOutEdge } from '../../diagram';
import { edgeKindLabel, markerId } from './constants';

export interface DiagramEdgeProps {
  edge: LaidOutEdge;
}

/** Rough width-per-character estimate used only to size the label's background badge. */
const CHAR_WIDTH_FACTOR = 0.62;
const LABEL_PADDING = 8;
const LABEL_BADGE_HEIGHT = EDGE_LABEL_FONT_SIZE + 4;

export function DiagramEdge({ edge }: DiagramEdgeProps): ReactElement {
  const rawLabel = edge.label.trim().length === 0 ? edgeKindLabel(edge.kind) : edge.label;
  const label = truncateText(rawLabel, EDGE_LABEL_MAX_CHARS);
  const labelWidth = label.length * (EDGE_LABEL_FONT_SIZE * CHAR_WIDTH_FACTOR) + LABEL_PADDING;

  return (
    <g className={`diagram-edge diagram-edge-${edge.kind}`}>
      <path d={edge.path} className="diagram-edge-path" markerEnd={`url(#${markerId(edge.kind)})`} />
      <rect
        x={edge.labelX - labelWidth / 2}
        y={edge.labelY - EDGE_LABEL_FONT_SIZE}
        width={labelWidth}
        height={LABEL_BADGE_HEIGHT}
        rx={3}
        className="diagram-edge-label-bg"
      />
      <text x={edge.labelX} y={edge.labelY - 2} textAnchor="middle" className="diagram-edge-label">
        {label}
      </text>
    </g>
  );
}
