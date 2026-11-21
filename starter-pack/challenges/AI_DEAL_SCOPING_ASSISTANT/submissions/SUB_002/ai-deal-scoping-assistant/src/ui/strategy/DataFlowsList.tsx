/** Plain-language description of how information moves between systems and the platform (spec 4). */
import type { ReactElement } from 'react';
import type { DataFlow } from '../../domain';
import { EmptyState } from '../common';

export interface DataFlowsListProps {
  flows: DataFlow[];
}

export function DataFlowsList({ flows }: DataFlowsListProps): ReactElement {
  if (flows.length === 0) {
    return <EmptyState title="No data flows yet" message="Flows are derived once integrations and the architecture design are both in place." />;
  }

  return (
    <ul className="strategy-flow-list">
      {flows.map((flow, index) => (
        <li key={`${flow.from}-${flow.to}-${index}`} className="strategy-flow-item">
          <span className="strategy-flow-path">
            <strong>{flow.from}</strong> {'→'} <strong>{flow.to}</strong>
          </span>
          <span className="text-muted text-sm">
            {flow.payload} via {flow.mechanism}
          </span>
        </li>
      ))}
    </ul>
  );
}
