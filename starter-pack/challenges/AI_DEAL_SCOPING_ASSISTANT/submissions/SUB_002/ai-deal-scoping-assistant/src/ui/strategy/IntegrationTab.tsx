/** "Integration architecture" tab (spec 4): inventory, the data/integration diagram, and the flow narrative. */
import type { ReactElement } from 'react';
import type { ArchitectureDesign, DataIntegrationOutput } from '../../domain';
import { EmptyState, SectionHeader } from '../common';
import { buildComponentLookup } from './componentNames';
import { DataFlowDiagramCard } from './DataFlowDiagramCard';
import { DataFlowsList } from './DataFlowsList';
import { IntegrationInventoryTable } from './IntegrationInventoryTable';

export interface IntegrationTabProps {
  plan: DataIntegrationOutput | null;
  design: ArchitectureDesign | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

const READY_MESSAGE = 'Use "Plan the data flow" above to generate the integration inventory and diagram from the reviewed scope.';

export function IntegrationTab({ plan, design, prerequisite, onSelectRequirement }: IntegrationTabProps): ReactElement {
  if (plan === null) {
    return (
      <EmptyState
        title={prerequisite !== null ? 'Integration architecture not available yet' : 'No integration architecture yet'}
        message={prerequisite ?? READY_MESSAGE}
      />
    );
  }

  const componentLookup = buildComponentLookup(design);

  return (
    <div className="stack stack-lg">
      <SectionHeader as="h3" title="Integration inventory" description="Internal and external systems, their pattern, protocol, error handling and readiness." />
      <IntegrationInventoryTable integrations={plan.integrations} componentLookup={componentLookup} onSelectRequirement={onSelectRequirement} />
      <DataFlowDiagramCard plan={plan} design={design} onSelectRequirement={onSelectRequirement} />
      <SectionHeader as="h3" title="How information moves" description="A plain-language description of each flow between systems, the integration layer and the platform." />
      <DataFlowsList flows={plan.flows} />
    </div>
  );
}
