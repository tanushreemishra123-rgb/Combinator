/**
 * Renders a `DiagramModel` as accessible JSX SVG (spec: "an architecture diagram or another clear
 * visual representation"): tier bands, node boxes, flow edges with arrow markers and a distinct
 * stroke style per edge kind, a legend, zoom controls and a text alternative so the diagram never
 * depends on sight alone. Built entirely from JSX elements - never an injected SVG string (SAST
 * rule: no raw markup construction outside `src/markup`).
 */
import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { layoutDiagram } from '../../diagram';
import type { DiagramModel } from '../../domain';
import { Callout } from '../common';
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './constants';
import { DiagramArrowDefs } from './DiagramArrowDefs';
import { DiagramEdge } from './DiagramEdge';
import { DiagramLegend } from './DiagramLegend';
import { DiagramNode } from './DiagramNode';
import { DiagramTextAlternative } from './DiagramTextAlternative';
import { DiagramTierBand } from './DiagramTierBand';
import { DiagramToolbar } from './DiagramToolbar';
import './diagram.css';

export interface DiagramViewProps {
  model: DiagramModel;
  /** Accessible name of the diagram, e.g. 'Proposed solution architecture on Microsoft Azure'. */
  ariaLabel: string;
  onSelectNode?: (nodeId: string) => void;
}

function zoomPercent(zoom: number): number {
  return Math.round(zoom * 100);
}

function diagramDescription(layout: { tiers: readonly { label: string }[]; nodes: readonly unknown[]; edges: readonly unknown[] }): string {
  const tierNames = layout.tiers.map((tier) => tier.label).join(', ');
  return `Tiers: ${tierNames}. ${layout.nodes.length} components and ${layout.edges.length} flows.`;
}

export function DiagramView({ model, ariaLabel, onSelectNode }: DiagramViewProps): ReactElement {
  const layout = useMemo(() => layoutDiagram(model), [model]);
  const [zoom, setZoom] = useState(1);
  const titleId = useId();
  const descId = useId();

  if (layout.nodes.length === 0) {
    return <Callout tone="info">This diagram has no components to draw yet.</Callout>;
  }

  return (
    <div className="diagram-view stack stack-md">
      <DiagramToolbar
        zoomPct={zoomPercent(zoom)}
        canZoomIn={zoom < ZOOM_MAX}
        canZoomOut={zoom > ZOOM_MIN}
        onZoomIn={() => setZoom((prev) => clampZoom(prev + ZOOM_STEP))}
        onZoomOut={() => setZoom((prev) => clampZoom(prev - ZOOM_STEP))}
        onReset={() => setZoom(1)}
      />
      <div className="diagram-scroll">
        <svg
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descId}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ width: layout.width * zoom, height: layout.height * zoom }}
          className="diagram-svg"
        >
          <title id={titleId}>{ariaLabel}</title>
          <desc id={descId}>{diagramDescription(layout)}</desc>
          <DiagramArrowDefs />
          {layout.tiers.map((tier) => (
            <DiagramTierBand key={tier.id} tier={tier} />
          ))}
          {layout.edges.map((edge, index) => (
            <DiagramEdge key={`edge-${index}-${edge.from}-${edge.to}`} edge={edge} />
          ))}
          {layout.nodes.map((node) => (
            <DiagramNode key={node.id} node={node} onSelect={onSelectNode ? () => onSelectNode(node.id) : undefined} />
          ))}
        </svg>
      </div>
      <DiagramLegend />
      <DiagramTextAlternative model={model} onSelectNode={onSelectNode} />
    </div>
  );
}
