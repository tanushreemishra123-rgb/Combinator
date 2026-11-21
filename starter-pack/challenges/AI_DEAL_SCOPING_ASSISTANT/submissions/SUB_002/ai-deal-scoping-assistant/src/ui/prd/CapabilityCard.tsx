/**
 * One functional-scope capability rendered in the spec's example format (Capability / Included
 * Requirements / Scope / Priority / Dependencies - challenge spec section "2. PRD and Functional
 * Scope Generation"), plus its grounding label, module/workstream/delivery
 * package placement and acceptance hints.
 */
import type { ReactElement } from 'react';
import type { Capability } from '../../domain';
import { Card, ContentLabelBadge, Disclosure, PriorityBadge, RefChips } from '../common';

export interface CapabilityCardProps {
  capability: Capability;
  onSelectRequirement: (id: string) => void;
}

export function CapabilityCard({ capability, onSelectRequirement }: CapabilityCardProps): ReactElement {
  return (
    <Card
      className="capability-card"
      title={capability.name}
      subtitle={`${capability.module} • ${capability.workstream} • ${capability.deliveryPackage}`}
      actions={
        <span className="cluster">
          <ContentLabelBadge label={capability.label} />
          <PriorityBadge priority={capability.priority} />
        </span>
      }
    >
      <div className="stack stack-sm">
        <div>
          <p className="capability-card-label text-subtle text-xs">Included requirements</p>
          <RefChips refs={capability.requirementIds} onSelect={onSelectRequirement} emptyLabel="No requirements cited yet" />
        </div>
        <div>
          <p className="capability-card-label text-subtle text-xs">Scope</p>
          <p className="text-sm">{capability.scope}</p>
        </div>
        <div>
          <p className="capability-card-label text-subtle text-xs">Dependencies</p>
          {capability.dependencies.length === 0 ? (
            <p className="text-muted text-sm">No dependencies identified.</p>
          ) : (
            <ul className="capability-dependency-list">
              {capability.dependencies.map((dependency) => (
                <li key={dependency}>{dependency}</li>
              ))}
            </ul>
          )}
        </div>
        {capability.acceptance.length > 0 ? (
          <Disclosure summary="Acceptance hints">
            <ul className="capability-acceptance-list">
              {capability.acceptance.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>
    </Card>
  );
}
