/** Delivery phases table (spec 5: "Delivery phases", "Major milestones") - the accessible source of truth the Gantt chart illustrates. */
import type { ReactElement } from 'react';
import type { PhaseEstimate } from '../../../domain';
import { Badge, DataTable } from '../../common';
import type { DataTableColumn } from '../../common';
import { formatNumericRange } from '../format';

export interface PhasesTableProps {
  phases: PhaseEstimate[];
}

function WorkstreamIds({ ids }: { ids: string[] }): ReactElement {
  if (ids.length === 0) {
    return <span className="text-subtle text-sm">Overhead phase</span>;
  }
  return (
    <span className="cluster">
      {ids.map((id) => (
        <Badge key={id} tone="neutral">
          {id}
        </Badge>
      ))}
    </span>
  );
}

function renderExpanded(phase: PhaseEstimate): ReactElement {
  return (
    <ol className="stack stack-xs phase-calculation-list">
      {phase.calculation.map((step) => (
        <li key={step} className="text-sm">
          {step}
        </li>
      ))}
    </ol>
  );
}

const COLUMNS: DataTableColumn<PhaseEstimate>[] = [
  { id: 'name', header: 'Phase', render: (phase) => phase.name },
  { id: 'workstreams', header: 'Workstreams', render: (phase) => <WorkstreamIds ids={phase.workstreamIds} /> },
  { id: 'effort', header: 'Effort', render: (phase) => formatNumericRange(phase.effortDays, 'person-days') },
  { id: 'duration', header: 'Duration', render: (phase) => formatNumericRange(phase.durationWeeks, 'weeks') },
  { id: 'startWeek', header: 'Start week', align: 'end', render: (phase) => phase.startWeek },
  { id: 'milestone', header: 'Milestone', render: (phase) => phase.milestone },
];

export function PhasesTable({ phases }: PhasesTableProps): ReactElement {
  return <DataTable caption="Delivery phases with effort, duration, start week and milestone" columns={COLUMNS} rows={phases} getRowId={(phase) => phase.id} renderExpanded={renderExpanded} />;
}
