/** Renders the functional-scope capability list grouped the way the reviewer picks (spec: "grouping switcher"). */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Capability, DeliveryPackagePlan, FunctionalScope, ScopeGrouping } from '../../domain';
import { Badge, Card, EmptyState } from '../common';
import { CapabilityCard } from './CapabilityCard';
import { engagementModelLabel } from './statusHelpers';

export type CapabilityGrouping = 'capability' | 'module' | 'workstream' | 'package';

export interface FunctionalScopeGroupsProps {
  functionalScope: FunctionalScope;
  grouping: CapabilityGrouping;
  onSelectRequirement: (id: string) => void;
}

function indexById(capabilities: readonly Capability[]): Map<string, Capability> {
  return new Map(capabilities.map((capability) => [capability.id, capability]));
}

/** Resolves a group's capability ids to the full capabilities, silently skipping any id that no longer resolves. */
function resolve(ids: readonly string[], index: Map<string, Capability>): Capability[] {
  const resolved: Capability[] = [];
  for (const id of ids) {
    const capability = index.get(id);
    if (capability !== undefined) {
      resolved.push(capability);
    }
  }
  return resolved;
}

interface GroupCardProps {
  name: string;
  capabilities: Capability[];
  extra?: ReactElement;
  onSelectRequirement: (id: string) => void;
}

function GroupCard({ name, capabilities, extra, onSelectRequirement }: GroupCardProps): ReactElement {
  return (
    <Card title={name} actions={extra}>
      <div className="capability-flat-list">
        {capabilities.map((capability) => (
          <CapabilityCard key={capability.id} capability={capability} onSelectRequirement={onSelectRequirement} />
        ))}
      </div>
    </Card>
  );
}

/** Engagement model plus suggested Topcoder challenge mix shown on a delivery-package group's header. */
function PackageMeta({ plan }: { plan: DeliveryPackagePlan }): ReactElement {
  return (
    <span className="cluster">
      <Badge tone="info">{engagementModelLabel(plan.engagementModel)}</Badge>
      {plan.suggestedChallengeTypes.map((type) => (
        <Badge key={type} tone="neutral">
          {type}
        </Badge>
      ))}
    </span>
  );
}

function renderGroups<T extends ScopeGrouping>(
  groups: readonly T[],
  index: Map<string, Capability>,
  onSelectRequirement: (id: string) => void,
  extraFor?: (group: T) => ReactElement,
): ReactElement {
  if (groups.length === 0) {
    return <EmptyState title="Nothing to group yet" message="Generate the PRD to see capabilities grouped this way." />;
  }
  return (
    <div className="stack stack-md">
      {groups.map((group) => (
        <GroupCard
          key={group.name}
          name={group.name}
          capabilities={resolve(group.capabilityIds, index)}
          extra={extraFor?.(group)}
          onSelectRequirement={onSelectRequirement}
        />
      ))}
    </div>
  );
}

export function FunctionalScopeGroups({ functionalScope, grouping, onSelectRequirement }: FunctionalScopeGroupsProps): ReactElement {
  const index = useMemo(() => indexById(functionalScope.capabilities), [functionalScope.capabilities]);

  if (grouping === 'capability') {
    if (functionalScope.capabilities.length === 0) {
      return <EmptyState title="No capabilities yet" message="Generate the PRD to see the functional scope." />;
    }
    return (
      <div className="capability-flat-list">
        {functionalScope.capabilities.map((capability) => (
          <CapabilityCard key={capability.id} capability={capability} onSelectRequirement={onSelectRequirement} />
        ))}
      </div>
    );
  }
  if (grouping === 'module') {
    return renderGroups(functionalScope.modules, index, onSelectRequirement);
  }
  if (grouping === 'workstream') {
    return renderGroups(functionalScope.workstreams, index, onSelectRequirement);
  }
  return renderGroups(functionalScope.deliveryPackages, index, onSelectRequirement, (group) => <PackageMeta plan={group} />);
}
