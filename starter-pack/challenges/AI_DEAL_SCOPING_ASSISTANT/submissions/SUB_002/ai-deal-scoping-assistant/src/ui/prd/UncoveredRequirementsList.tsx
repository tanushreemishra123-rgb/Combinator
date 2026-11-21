/** Requirements that no capability, architecture component or strategy element cites yet. */
import type { ReactElement } from 'react';
import type { CoverageRow } from '../../domain';
import { EmptyState, PriorityBadge, RefChips } from '../common';
import { CheckCircleIcon } from '../common/icons';

export interface UncoveredRequirementsListProps {
  rows: CoverageRow[];
  onSelectRequirement: (id: string) => void;
}

export function UncoveredRequirementsList({ rows, onSelectRequirement }: UncoveredRequirementsListProps): ReactElement {
  const uncovered = rows.filter((row) => !row.covered);

  if (uncovered.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleIcon />}
        title="Every reviewed requirement is covered"
        message="No requirement is missing a capability, architecture component or strategy element."
      />
    );
  }

  return (
    <ul className="stack stack-sm">
      {uncovered.map((row) => (
        <li key={row.requirementId} className="coverage-uncovered-row cluster">
          <RefChips refs={[row.requirementId]} onSelect={onSelectRequirement} />
          <span>{row.title}</span>
          <PriorityBadge priority={row.priority} />
        </li>
      ))}
    </ul>
  );
}
