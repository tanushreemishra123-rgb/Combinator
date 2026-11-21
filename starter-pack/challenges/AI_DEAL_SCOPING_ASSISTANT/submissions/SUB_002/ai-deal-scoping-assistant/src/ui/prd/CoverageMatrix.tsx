/**
 * Requirement x capability coverage matrix (spec constraint: "identify uncovered requirements and
 * unsupported scope additions without requiring the reviewer to manually compare the complete
 * documents"). Horizontally scrollable with a sticky first column so long requirement titles stay
 * readable next to however many capability columns the reviewed scope produced.
 */
import type { ReactElement } from 'react';
import type { Capability, CoverageRow } from '../../domain';
import { EmptyState, PriorityBadge, RefChips } from '../common';
import { CheckCircleIcon } from '../common/icons';

export interface CoverageMatrixProps {
  rows: CoverageRow[];
  columns: Capability[];
  onSelectRequirement: (id: string) => void;
}

function CoverageCell({ covered }: { covered: boolean }): ReactElement {
  if (!covered) {
    return <span className="sr-only">Not covered</span>;
  }
  return (
    <span>
      <CheckCircleIcon size={16} className="coverage-matrix-covered" />
      <span className="sr-only">Covered</span>
    </span>
  );
}

export function CoverageMatrix({ rows, columns, onSelectRequirement }: CoverageMatrixProps): ReactElement {
  if (rows.length === 0) {
    return <EmptyState title="No requirements yet" message="Approve at least one requirement to see the coverage matrix." />;
  }

  return (
    <div className="coverage-matrix-scroll">
      <table className="coverage-matrix">
        <thead>
          <tr>
            <th scope="col" className="coverage-matrix-sticky-col">
              Requirement
            </th>
            <th scope="col">Priority</th>
            {columns.map((column) => (
              <th scope="col" key={column.id}>
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.requirementId}>
              <th scope="row" className="coverage-matrix-sticky-col">
                <span className="cluster">
                  <RefChips refs={[row.requirementId]} onSelect={onSelectRequirement} />
                  <span>{row.title}</span>
                </span>
              </th>
              <td>
                <PriorityBadge priority={row.priority} />
              </td>
              {columns.map((column) => (
                <td key={column.id} className="align-center">
                  <CoverageCell covered={row.capabilityIds.includes(column.id)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
