/** Effort adjustments applied to a workstream (e.g. environment uplift, productivity factor). */
import type { ReactElement } from 'react';
import type { EffortAdjustment } from '../../../domain';
import { EmptyState } from '../../common';

export interface AdjustmentsListProps {
  adjustments: EffortAdjustment[];
}

export function AdjustmentsList({ adjustments }: AdjustmentsListProps): ReactElement {
  if (adjustments.length === 0) {
    return <EmptyState title="No adjustments" message="No environment, productivity or overhead adjustment applies to this workstream." />;
  }
  return (
    <ul className="stack stack-xs">
      {adjustments.map((adjustment) => (
        <li key={adjustment.label} className="text-sm">
          <strong>{adjustment.label}</strong> (x{adjustment.factor.toFixed(2)}) - {adjustment.reason}
        </li>
      ))}
    </ul>
  );
}
