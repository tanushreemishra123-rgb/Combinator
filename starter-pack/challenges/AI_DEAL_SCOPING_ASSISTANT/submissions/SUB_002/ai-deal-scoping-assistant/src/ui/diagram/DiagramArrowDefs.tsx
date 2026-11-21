/** One arrowhead marker per edge kind, referenced by every edge path's `marker-end`. */
import type { ReactElement } from 'react';
import { EDGE_KINDS, markerId } from './constants';

export function DiagramArrowDefs(): ReactElement {
  return (
    <defs>
      {EDGE_KINDS.map((kind) => (
        <marker
          key={kind}
          id={markerId(kind)}
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={8}
          markerHeight={8}
          orient="auto-start-reverse"
          className={`diagram-marker diagram-marker-${kind}`}
        >
          <path d="M0,0 L10,5 L0,10 z" />
        </marker>
      ))}
    </defs>
  );
}
