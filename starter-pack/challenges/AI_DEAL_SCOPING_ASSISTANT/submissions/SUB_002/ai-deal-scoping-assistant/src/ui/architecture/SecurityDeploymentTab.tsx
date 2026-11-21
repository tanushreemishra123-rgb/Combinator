/**
 * "Security and deployment" tab (spec "Recommended Application Sections 3" + Functional
 * Requirements 3 area list): security controls, deployment and runtime approach, the environment
 * plan, availability/scalability and backup/disaster recovery - each traced back to the
 * requirement, security need or assumption that justifies it.
 */
import type { ReactElement } from 'react';
import type { ArchitectureDesign, EnvironmentPlan } from '../../domain';
import { Card, DataTable, EmptyState, TracedStatementList } from '../common';
import type { DataTableColumn } from '../common';

export interface SecurityDeploymentTabProps {
  design: ArchitectureDesign | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

const READY_MESSAGE = 'Use "Design the solution" above to generate the security and deployment approach from the reviewed scope.';

const ENVIRONMENT_COLUMNS: DataTableColumn<EnvironmentPlan>[] = [
  { id: 'name', header: 'Environment', render: (row) => row.name },
  { id: 'purpose', header: 'Purpose', render: (row) => row.purpose },
  { id: 'sizing', header: 'Sizing', render: (row) => row.sizing },
];

function EnvironmentsTable({ environments }: { environments: EnvironmentPlan[] }): ReactElement {
  return (
    <DataTable
      columns={ENVIRONMENT_COLUMNS}
      rows={environments}
      getRowId={(row) => row.name}
      emptyState={<EmptyState title="No environments planned yet" />}
      caption="Development, test and production environments"
    />
  );
}

export function SecurityDeploymentTab({ design, prerequisite, onSelectRequirement }: SecurityDeploymentTabProps): ReactElement {
  if (design === null) {
    return (
      <EmptyState
        title={prerequisite !== null ? 'Security and deployment approach not available yet' : 'No security and deployment approach yet'}
        message={prerequisite ?? READY_MESSAGE}
      />
    );
  }

  return (
    <div className="stack stack-lg">
      <Card title="Security controls" subtitle="Controls proposed to protect the solution, each traced to the requirement, security need or assumption that justifies it.">
        <TracedStatementList statements={design.securityControls} onSelectRef={onSelectRequirement} emptyMessage="No security controls recorded." />
      </Card>
      <Card title="Deployment and runtime approach">
        <TracedStatementList statements={design.deployment} onSelectRef={onSelectRequirement} emptyMessage="No deployment approach recorded." />
      </Card>
      <Card title="Development, test, and production environments">
        <EnvironmentsTable environments={design.environments} />
      </Card>
      <Card title="Availability and scalability">
        <TracedStatementList statements={design.availability} onSelectRef={onSelectRequirement} emptyMessage="No availability or scalability approach recorded." />
      </Card>
      <Card title="Backup and disaster recovery">
        <TracedStatementList statements={design.backupDr} onSelectRef={onSelectRequirement} emptyMessage="No backup or disaster-recovery approach recorded." />
      </Card>
    </div>
  );
}
