/**
 * Turns an ArchitectureDesign into the renderer-neutral DiagramModel (src/domain/diagram.ts): the
 * same model the UI draws as SVG and the exporters turn into Mermaid text. Every component becomes
 * a node placed in one of seven delivery tiers by its architecture area; every flow becomes an
 * edge; a flow endpoint the design did not plan as a component is rendered as an external node
 * (see externalRef.ts for how that endpoint id carries a human-readable label and its citing id).
 *
 * Several integrations can cite the same external system (e.g. three integrations all synchronizing
 * with the same claims platform), which encodes as three distinct endpoint ids - one per citing id
 * (externalRef.ts). Those are merged here by display label (case-insensitive, trimmed) into a single
 * node so the diagram never draws the same system as several boxes; edges are re-pointed at the
 * merged node and any that become identical (same from, to and kind) are combined into one, joining
 * their distinct labels with ' / '.
 */
import type { ArchitectureArea, ArchitectureDesign, DiagramEdge, DiagramEdgeKind, DiagramModel, DiagramNode, DiagramTier } from '../domain';
import { platformLabel } from './catalog/cloudServiceCatalog.data';
import { makeExternalId, parseExternalId } from './externalRef';

const TIERS: readonly DiagramTier[] = [
  { id: 'users-channels', label: 'Users and Channels' },
  { id: 'edge-security', label: 'Edge and Security' },
  { id: 'application', label: 'Application' },
  { id: 'integration-messaging', label: 'Integration and Messaging' },
  { id: 'data', label: 'Data' },
  { id: 'ai-ml', label: 'AI and ML' },
  { id: 'operations', label: 'Operations' },
];

const AREA_TO_TIER: ReadonlyMap<ArchitectureArea, string> = new Map([
  ['user-apps', 'users-channels'],
  ['api', 'edge-security'],
  ['identity', 'edge-security'],
  ['security', 'edge-security'],
  ['backend', 'application'],
  ['messaging', 'integration-messaging'],
  ['integration', 'integration-messaging'],
  ['data-storage', 'data'],
  ['ai-ml', 'ai-ml'],
  ['observability', 'operations'],
  ['deployment', 'operations'],
  ['environments', 'operations'],
  ['availability', 'operations'],
  ['backup-dr', 'operations'],
]);

/** External systems are drawn alongside the components they exchange data with. */
const EXTERNAL_NODE_TIER = 'integration-messaging';

function tierForArea(area: ArchitectureArea): string {
  return AREA_TO_TIER.get(area) ?? 'application';
}

function buildComponentNodes(design: ArchitectureDesign): DiagramNode[] {
  return design.components.map((component) => ({
    id: component.id,
    label: component.name,
    sublabel: component.service,
    tierId: tierForArea(component.area),
    refs: [...component.requirementIds, ...component.assumptionIds],
    external: false,
  }));
}

/** A citing id's external flow endpoints ('ext:<citingId>:<label>') that share one display label. */
interface ExternalGroup {
  nodeId: string;
  label: string;
  refs: string[];
}

/** Case-insensitive, trimmed key so "Guidewire ClaimCenter" and " guidewire claimcenter" merge. */
function externalLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Every flow endpoint the design did not plan as a component, in first-seen order. */
function externalEndpoints(design: ArchitectureDesign, componentIds: ReadonlySet<string>): string[] {
  const endpoints = new Set<string>();
  for (const flow of design.flows) {
    if (!componentIds.has(flow.from)) {
      endpoints.add(flow.from);
    }
    if (!componentIds.has(flow.to)) {
      endpoints.add(flow.to);
    }
  }
  return [...endpoints];
}

/** One group per distinct display label, with the sorted, distinct union of every citing id. */
function groupExternalEndpoints(endpoints: readonly string[]): Map<string, ExternalGroup> {
  const refsByLabel = new Map<string, { label: string; refs: Set<string> }>();
  for (const endpoint of endpoints) {
    const parsed = parseExternalId(endpoint);
    if (parsed === null) {
      continue;
    }
    const key = externalLabelKey(parsed.label);
    const existing = refsByLabel.get(key);
    if (existing === undefined) {
      refsByLabel.set(key, { label: parsed.label.trim(), refs: new Set([parsed.refId]) });
    } else {
      existing.refs.add(parsed.refId);
    }
  }
  const groups = new Map<string, ExternalGroup>();
  for (const [key, group] of refsByLabel) {
    const refs = [...group.refs].sort();
    groups.set(key, { nodeId: makeExternalId(refs.join('+'), group.label), label: group.label, refs });
  }
  return groups;
}

/** One external node per merged group instead of one per citing id. */
function buildExternalNodes(groups: ReadonlyMap<string, ExternalGroup>): DiagramNode[] {
  return [...groups.values()].map((group) => ({
    id: group.nodeId,
    label: group.label,
    sublabel: 'External system',
    tierId: EXTERNAL_NODE_TIER,
    refs: group.refs,
    external: true,
  }));
}

/** Every original endpoint id (one per citing integration) to the merged node id it now draws as. */
function endpointNodeIds(endpoints: readonly string[], groups: ReadonlyMap<string, ExternalGroup>): Map<string, string> {
  const nodeIdByEndpoint = new Map<string, string>();
  for (const endpoint of endpoints) {
    const parsed = parseExternalId(endpoint);
    const group = parsed === null ? undefined : groups.get(externalLabelKey(parsed.label));
    if (group !== undefined) {
      nodeIdByEndpoint.set(endpoint, group.nodeId);
    }
  }
  return nodeIdByEndpoint;
}

function remapEndpoint(id: string, nodeIdByEndpoint: ReadonlyMap<string, string>): string {
  return nodeIdByEndpoint.get(id) ?? id;
}

/** One from/to/kind combination, with every distinct label seen for it. */
interface EdgeGroup {
  from: string;
  to: string;
  kind: DiagramEdgeKind;
  labels: string[];
}

/** Separator for the from/to/kind grouping key below; node ids and edge kinds never contain it. */
const EDGE_GROUP_KEY_SEPARATOR = ' :: ';

/** Combines edges that became identical once their endpoints were re-pointed at a merged node. */
function mergeIdenticalEdges(edges: readonly DiagramEdge[]): DiagramEdge[] {
  const groups = new Map<string, EdgeGroup>();
  for (const edge of edges) {
    const key = [edge.from, edge.to, edge.kind].join(EDGE_GROUP_KEY_SEPARATOR);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { from: edge.from, to: edge.to, kind: edge.kind, labels: [edge.label] });
    } else if (!existing.labels.includes(edge.label)) {
      existing.labels.push(edge.label);
    }
  }
  return [...groups.values()].map((group) => ({ from: group.from, to: group.to, kind: group.kind, label: group.labels.join(' / ') }));
}

function buildEdges(design: ArchitectureDesign, nodeIdByEndpoint: ReadonlyMap<string, string>): DiagramEdge[] {
  const rePointed = design.flows.map((flow) => ({
    from: remapEndpoint(flow.from, nodeIdByEndpoint),
    to: remapEndpoint(flow.to, nodeIdByEndpoint),
    label: flow.label,
    kind: flow.kind,
  }));
  return mergeIdenticalEdges(rePointed);
}

/** Builds the diagram model for a completed architecture design (see src/domain/diagram.ts). */
export function buildArchitectureDiagram(design: ArchitectureDesign): DiagramModel {
  const componentIds = new Set(design.components.map((component) => component.id));
  const endpoints = externalEndpoints(design, componentIds);
  const groups = groupExternalEndpoints(endpoints);
  const nodeIdByEndpoint = endpointNodeIds(endpoints, groups);
  const nodes = [...buildComponentNodes(design), ...buildExternalNodes(groups)];
  return {
    title: `${platformLabel(design.platform)} Solution Architecture`,
    tiers: [...TIERS],
    nodes,
    edges: buildEdges(design, nodeIdByEndpoint),
  };
}
