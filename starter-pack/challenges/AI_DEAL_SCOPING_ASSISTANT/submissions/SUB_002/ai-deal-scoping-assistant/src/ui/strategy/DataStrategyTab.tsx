/** "Data strategy" tab (spec 4): domains table plus the ten data-management topic cards. */
import type { ReactElement } from 'react';
import type { DataIntegrationOutput } from '../../domain';
import { EmptyState, SectionHeader } from '../common';
import { DataDomainsTable } from './DataDomainsTable';
import { DataTopicCards } from './DataTopicCards';

export interface DataStrategyTabProps {
  plan: DataIntegrationOutput | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

const READY_MESSAGE = 'Use "Plan the data flow" above to generate the data domains and topic-by-topic approach from the reviewed scope.';

export function DataStrategyTab({ plan, prerequisite, onSelectRequirement }: DataStrategyTabProps): ReactElement {
  if (plan === null) {
    return (
      <EmptyState
        title={prerequisite !== null ? 'Data strategy not available yet' : 'No data strategy yet'}
        message={prerequisite ?? READY_MESSAGE}
      />
    );
  }

  return (
    <div className="stack stack-lg">
      <SectionHeader as="h3" title="Data domains" description="Major data domains, their sources, ownership and classification." />
      <DataDomainsTable domains={plan.domains} onSelectRequirement={onSelectRequirement} />
      <SectionHeader as="h3" title="Data topics" description="How the platform handles each data-management topic." />
      <DataTopicCards topics={plan.topics} onSelectRequirement={onSelectRequirement} />
    </div>
  );
}
