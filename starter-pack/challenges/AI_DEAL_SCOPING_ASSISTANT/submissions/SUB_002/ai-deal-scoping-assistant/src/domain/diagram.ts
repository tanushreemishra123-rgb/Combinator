/**
 * Renderer-neutral diagram model. The architecture and data-flow planners emit it, the UI draws it
 * as SVG, and the exporters turn the same model into Mermaid text, so every view stays in sync.
 */
export type DiagramEdgeKind = 'request' | 'event' | 'data' | 'batch' | 'auth' | 'telemetry';

export interface DiagramNode {
  id: string;
  label: string;
  /** Concrete cloud service or system name shown under the label. */
  sublabel: string;
  tierId: string;
  /** Requirement / assumption IDs that justify the node. */
  refs: string[];
  external: boolean;
}

export interface DiagramTier {
  id: string;
  label: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label: string;
  kind: DiagramEdgeKind;
}

export interface DiagramModel {
  title: string;
  tiers: DiagramTier[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
