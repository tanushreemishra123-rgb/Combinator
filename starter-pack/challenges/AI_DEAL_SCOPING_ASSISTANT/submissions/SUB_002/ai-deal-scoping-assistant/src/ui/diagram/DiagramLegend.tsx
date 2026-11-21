/** Legend mapping each edge kind's distinct stroke style to its meaning. */
import type { ReactElement } from 'react';
import { EDGE_KINDS, edgeKindLabel } from './constants';

export function DiagramLegend(): ReactElement {
  return (
    <ul className="diagram-legend" aria-label="Diagram edge legend">
      {EDGE_KINDS.map((kind) => (
        <li key={kind} className={`diagram-legend-item diagram-legend-${kind}`}>
          <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="diagram-legend-swatch">
            <line x1="1" y1="5" x2="24" y2="5" className="diagram-legend-line" />
          </svg>
          <span>{edgeKindLabel(kind)}</span>
        </li>
      ))}
    </ul>
  );
}
