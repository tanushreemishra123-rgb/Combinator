/**
 * Shared field list for one architecture component, in the spec's example format (Functional
 * Requirements 3, "Cloud Solution Architecture": Logical Component, Selected Platform, Recommended
 * Service, Supported Requirements, Purpose, Rationale, Trade-offs, Dependencies, Security
 * considerations, Assumptions). Used by both the component card grid and the diagram's node-detail
 * drawer so the two never drift apart.
 */
import type { ReactElement, ReactNode } from 'react';
import { platformLabel } from '../../architecture';
import type { ArchitectureComponent, CloudPlatform, ScopeModel } from '../../domain';
import { RefChips } from '../common';
import { resolveScopeItemLabel } from './scopeLookup';

export interface ComponentFieldsProps {
  component: ArchitectureComponent;
  platform: CloudPlatform;
  scope: ScopeModel | null;
  onSelectRequirement: (id: string) => void;
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div>
      <p className="component-field-label text-subtle text-xs">{label}</p>
      {children}
    </div>
  );
}

function TextList({ items, emptyLabel }: { items: readonly string[]; emptyLabel: string }): ReactElement {
  if (items.length === 0) {
    return <p className="text-muted text-sm">{emptyLabel}</p>;
  }
  return (
    <ul className="component-field-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AssumptionsList({ ids, scope }: { ids: readonly string[]; scope: ScopeModel | null }): ReactElement {
  if (ids.length === 0) {
    return <p className="text-muted text-sm">No assumption cited.</p>;
  }
  return (
    <ul className="component-field-list">
      {ids.map((id) => (
        <li key={id}>{resolveScopeItemLabel(scope, id)}</li>
      ))}
    </ul>
  );
}

export function ComponentFields({ component, platform, scope, onSelectRequirement }: ComponentFieldsProps): ReactElement {
  return (
    <div className="stack stack-sm">
      <FieldBlock label="Selected platform">
        <p className="text-sm">{platformLabel(platform)}</p>
      </FieldBlock>
      <FieldBlock label="Recommended service">
        <p className="text-sm">{component.service}</p>
      </FieldBlock>
      <FieldBlock label="Supported requirements">
        <RefChips refs={component.requirementIds} onSelect={onSelectRequirement} emptyLabel="No requirements cited yet" />
      </FieldBlock>
      <FieldBlock label="Purpose">
        <p className="text-sm">{component.purpose}</p>
      </FieldBlock>
      <FieldBlock label="Rationale">
        <p className="text-sm">{component.rationale}</p>
      </FieldBlock>
      <FieldBlock label="Trade-offs">
        <TextList items={component.tradeOffs} emptyLabel="No trade-offs recorded." />
      </FieldBlock>
      <FieldBlock label="Dependencies">
        <TextList items={component.dependencies} emptyLabel="No dependencies identified." />
      </FieldBlock>
      <FieldBlock label="Security considerations">
        <TextList items={component.securityConsiderations} emptyLabel="No security considerations recorded." />
      </FieldBlock>
      <FieldBlock label="Assumptions">
        <AssumptionsList ids={component.assumptionIds} scope={scope} />
      </FieldBlock>
    </div>
  );
}
