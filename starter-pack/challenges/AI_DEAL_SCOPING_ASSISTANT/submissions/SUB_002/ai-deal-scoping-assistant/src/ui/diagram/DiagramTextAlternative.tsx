/**
 * Accessible text alternative to the SVG picture: a collapsible list of nodes grouped by tier,
 * plus a collapsible list of the flows between them (spec: "another clear visual representation"
 * must not depend on sight alone).
 */
import type { ReactElement } from 'react';
import { Disclosure } from '../common';
import type { DiagramModel, DiagramNode, DiagramTier } from '../../domain';
import { edgeKindLabel } from './constants';

export interface DiagramTextAlternativeProps {
  model: DiagramModel;
  onSelectNode?: (nodeId: string) => void;
}

interface TierGroup {
  tier: DiagramTier;
  nodes: DiagramNode[];
}

/** Mirrors layoutDiagram's own grouping: a node naming an unrecognised tier is silently omitted. */
function groupNodesByTier(model: DiagramModel): TierGroup[] {
  const tierIds = new Set(model.tiers.map((tier) => tier.id));
  const byTier = new Map<string, DiagramNode[]>();
  for (const node of model.nodes) {
    if (!tierIds.has(node.tierId)) {
      continue;
    }
    const bucket = byTier.get(node.tierId) ?? [];
    bucket.push(node);
    byTier.set(node.tierId, bucket);
  }
  return model.tiers.map((tier) => ({ tier, nodes: byTier.get(tier.id) ?? [] }));
}

function nodeDetail(node: DiagramNode): string {
  const refs = node.refs.length === 0 ? 'no linked requirements' : `refs ${node.refs.join(', ')}`;
  const kind = node.external ? 'external system' : node.sublabel;
  return `${kind} - ${refs}`;
}

interface NodeRowProps {
  node: DiagramNode;
  onSelectNode?: (nodeId: string) => void;
}

function NodeRow({ node, onSelectNode }: NodeRowProps): ReactElement {
  return (
    <li className="diagram-text-alt-node">
      {onSelectNode ? (
        <button type="button" className="diagram-text-alt-node-button" onClick={() => onSelectNode(node.id)}>
          {node.label}
        </button>
      ) : (
        <span>{node.label}</span>
      )}
      <span className="text-muted text-sm"> - {nodeDetail(node)}</span>
    </li>
  );
}

function FlowRow({ from, to, kind, label }: { from: string; to: string; kind: DiagramModel['edges'][number]['kind']; label: string }): ReactElement {
  return (
    <li className="text-sm">
      {from} to {to} ({edgeKindLabel(kind)}){label.trim().length > 0 ? `: ${label}` : ''}
    </li>
  );
}

export function DiagramTextAlternative({ model, onSelectNode }: DiagramTextAlternativeProps): ReactElement {
  const groups = groupNodesByTier(model).filter((group) => group.nodes.length > 0);

  return (
    <div className="diagram-text-alt" role="region" aria-label="Diagram text alternative">
      {groups.map((group) => (
        <Disclosure key={group.tier.id} summary={`${group.tier.label} (${group.nodes.length})`}>
          <ul className="diagram-text-alt-list">
            {group.nodes.map((node) => (
              <NodeRow key={node.id} node={node} onSelectNode={onSelectNode} />
            ))}
          </ul>
        </Disclosure>
      ))}
      <Disclosure summary={`Flows (${model.edges.length})`}>
        <ul className="diagram-text-alt-list">
          {model.edges.map((edge, index) => (
            <FlowRow key={`${edge.from}-${edge.to}-${index}`} from={edge.from} to={edge.to} kind={edge.kind} label={edge.label} />
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
