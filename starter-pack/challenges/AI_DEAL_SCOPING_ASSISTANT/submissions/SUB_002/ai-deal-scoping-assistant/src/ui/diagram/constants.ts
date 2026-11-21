/**
 * Presentation-only constants for the JSX diagram renderer: the fixed edge-kind order and their
 * display labels, the arrowhead marker id scheme, and the zoom bounds for the toolbar controls.
 * Layout and text-budget constants themselves live in `src/diagram/constants.ts`.
 */
import type { DiagramEdgeKind } from '../../domain';

/** Every edge kind, in the fixed order the legend and arrow-marker defs render them. */
export const EDGE_KINDS: readonly DiagramEdgeKind[] = ['request', 'event', 'data', 'batch', 'auth', 'telemetry'];

const EDGE_KIND_LABELS: ReadonlyMap<DiagramEdgeKind, string> = new Map([
  ['request', 'Request'],
  ['event', 'Event'],
  ['data', 'Data'],
  ['batch', 'Batch'],
  ['auth', 'Auth'],
  ['telemetry', 'Telemetry'],
]);

/** Human-readable noun for an edge kind - the legend label and an unlabelled edge's caption. */
export function edgeKindLabel(kind: DiagramEdgeKind): string {
  return EDGE_KIND_LABELS.get(kind) ?? 'Flow';
}

/** Id of the arrowhead marker defined for one edge kind (see DiagramArrowDefs). */
export function markerId(kind: DiagramEdgeKind): string {
  return `diagram-arrow-${kind}`;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const ZOOM_STEP = 0.25;

/** Snaps a zoom value onto a clean step and keeps it within [ZOOM_MIN, ZOOM_MAX]. */
export function clampZoom(value: number): number {
  const stepped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, stepped));
}
