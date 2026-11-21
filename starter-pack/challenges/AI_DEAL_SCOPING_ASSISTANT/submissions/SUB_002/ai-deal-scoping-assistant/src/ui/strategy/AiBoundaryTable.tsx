/** "AI vs deterministic vs human decision" boundary table (spec 4) with three clearly distinct badges. */
import type { ReactElement } from 'react';
import type { ProcessingBoundary } from '../../domain';
import { DataTable, EmptyState, RefChips } from '../common';
import type { DataTableColumn } from '../common';
import { ProcessingTypeBadge } from './badges';

export interface AiBoundaryTableProps {
  boundaries: ProcessingBoundary[];
  onSelectRequirement: (id: string) => void;
}

function buildColumns(onSelectRequirement: (id: string) => void): DataTableColumn<ProcessingBoundary>[] {
  return [
    { id: 'activity', header: 'Activity', render: (row) => row.activity },
    { id: 'type', header: 'Handled by', render: (row) => <ProcessingTypeBadge type={row.type} /> },
    { id: 'reason', header: 'Why', render: (row) => row.reason },
    { id: 'requirements', header: 'Requirements', render: (row) => <RefChips refs={row.requirementIds} onSelect={onSelectRequirement} /> },
  ];
}

export function AiBoundaryTable({ boundaries, onSelectRequirement }: AiBoundaryTableProps): ReactElement {
  return (
    <DataTable
      columns={buildColumns(onSelectRequirement)}
      rows={boundaries}
      getRowId={(row) => `${row.type}-${row.activity}`}
      caption="Which activities are handled by AI, by deterministic rules, or require a human decision"
      emptyState={<EmptyState title="No processing boundaries yet" message="This table is built from the reviewed functional, integration and AI use cases." />}
    />
  );
}
