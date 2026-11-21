/**
 * "Requirement traceability" tab (spec "Recommended Application Sections 3" + Success Definition
 * 11: "Trace architecture components to requirements or assumptions"): which components justify
 * each reviewed requirement, and which components cite no justification at all (Functional
 * Requirements 3 constraint: "Every major architecture component must reference a customer
 * requirement, non-functional requirement, security need, or reviewed assumption").
 */
import type { ReactElement } from 'react';
import type { ArchitectureDesign, CoverageReport, CoverageRow, GenerationMeta, ValidationIssue } from '../../domain';
import { Card, DataTable, EmptyState, PriorityBadge, RefChips } from '../common';
import type { DataTableColumn } from '../common';
import { CheckCircleIcon } from '../common/icons';

export interface TraceabilityTabProps {
  design: ArchitectureDesign | null;
  coverage: CoverageReport | null;
  meta: GenerationMeta | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
  onSelectComponent: (componentId: string) => void;
}

const READY_MESSAGE = 'Use "Design the solution" above, then requirement traceability appears here automatically.';

function UnjustifiedComponentsList({ issues, onSelectComponent }: { issues: ValidationIssue[]; onSelectComponent: (id: string) => void }): ReactElement {
  const unjustified = issues.filter((issue) => issue.code === 'unjustified-component');
  if (unjustified.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleIcon />}
        title="Every component is justified"
        message="Every major architecture component cites a requirement, security need or reviewed assumption."
      />
    );
  }
  return (
    <ul className="stack stack-sm">
      {unjustified.map((issue) => (
        <li key={`${issue.code}-${issue.message}`} className="stack stack-xs">
          <RefChips refs={issue.refs} onSelect={onSelectComponent} emptyLabel="Unknown component" />
          <p className="text-sm">{issue.message}</p>
        </li>
      ))}
    </ul>
  );
}

function buildColumns(onSelectRequirement: (id: string) => void, onSelectComponent: (id: string) => void): DataTableColumn<CoverageRow>[] {
  return [
    {
      id: 'requirement',
      header: 'Requirement',
      render: (row) => (
        <span className="cluster">
          <RefChips refs={[row.requirementId]} onSelect={onSelectRequirement} />
          <span>{row.title}</span>
        </span>
      ),
    },
    { id: 'priority', header: 'Priority', render: (row) => <PriorityBadge priority={row.priority} /> },
    {
      id: 'components',
      header: 'Architecture components',
      render: (row) => <RefChips refs={row.componentIds} onSelect={onSelectComponent} emptyLabel="Not cited by an architecture component" />,
    },
  ];
}

export function TraceabilityTab({ design, coverage, meta, prerequisite, onSelectRequirement, onSelectComponent }: TraceabilityTabProps): ReactElement {
  if (design === null || coverage === null) {
    return (
      <EmptyState
        title={prerequisite !== null ? 'Requirement traceability not available yet' : 'No requirement traceability yet'}
        message={prerequisite ?? READY_MESSAGE}
      />
    );
  }

  const columns = buildColumns(onSelectRequirement, onSelectComponent);

  return (
    <div className="stack stack-lg">
      <Card
        title="Requirement to component traceability"
        subtitle="Every reviewed requirement against the architecture components that cite it."
      >
        <DataTable columns={columns} rows={coverage.rows} getRowId={(row) => row.requirementId} caption="Requirement to architecture component traceability" />
      </Card>
      <Card
        title="Components without justification"
        subtitle="Every major architecture component must reference a requirement, security need or reviewed assumption."
      >
        <UnjustifiedComponentsList issues={meta?.issues ?? []} onSelectComponent={onSelectComponent} />
      </Card>
    </div>
  );
}
