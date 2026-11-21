/**
 * "Functional Scope" tab (spec "PRD and Scope Workspace"): capability cards grouped by whichever
 * dimension the reviewer picks, recommended enhancements kept visibly separate, out-of-scope items
 * and the label legend.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { PrdBundle } from '../../domain';
import { Card, Tabs, TracedStatementList } from '../common';
import type { TabItem } from '../common';
import { FunctionalScopeGroups } from './FunctionalScopeGroups';
import type { CapabilityGrouping } from './FunctionalScopeGroups';
import { Legend } from './Legend';
import { PrdEmptyState } from './PrdEmptyState';
import { RecommendedEnhancements } from './RecommendedEnhancements';

export interface FunctionalScopeTabProps {
  bundle: PrdBundle | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

const GROUPING_TABS: TabItem[] = [
  { id: 'capability', label: 'By Capability' },
  { id: 'module', label: 'By Module' },
  { id: 'workstream', label: 'By Workstream' },
  { id: 'package', label: 'By Delivery Package' },
];

function isGrouping(value: string): value is CapabilityGrouping {
  return value === 'capability' || value === 'module' || value === 'workstream' || value === 'package';
}

export function FunctionalScopeTab({ bundle, prerequisite, onSelectRequirement }: FunctionalScopeTabProps): ReactElement {
  const [grouping, setGrouping] = useState<CapabilityGrouping>('capability');

  if (bundle === null) {
    return <PrdEmptyState prerequisite={prerequisite} />;
  }

  const { functionalScope } = bundle;

  return (
    <div className="stack stack-lg">
      <Card title="Functional scope" subtitle="Capabilities decomposed from the approved requirements, grouped the way you want to review them.">
        <Tabs
          items={GROUPING_TABS}
          activeId={grouping}
          onChange={(id) => {
            if (isGrouping(id)) {
              setGrouping(id);
            }
          }}
          ariaLabel="Group capabilities by"
        >
          {() => <FunctionalScopeGroups functionalScope={functionalScope} grouping={grouping} onSelectRequirement={onSelectRequirement} />}
        </Tabs>
      </Card>
      <RecommendedEnhancements enhancements={functionalScope.recommendedEnhancements} onSelectRequirement={onSelectRequirement} />
      <Card title="Out-of-scope items" subtitle="Explicitly excluded from this engagement's delivery scope.">
        <TracedStatementList statements={functionalScope.outOfScope} onSelectRef={onSelectRequirement} emptyMessage="No items explicitly marked out of scope." />
      </Card>
      <Legend />
    </div>
  );
}
