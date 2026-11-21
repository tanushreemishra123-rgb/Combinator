/** Generated elements that cite nothing, or cite an id outside the approved scope (spec constraint). */
import type { ReactElement } from 'react';
import type { UnsupportedAddition } from '../../domain';
import { Badge, EmptyState } from '../common';
import { CheckCircleIcon } from '../common/icons';

export interface UnsupportedAdditionsListProps {
  additions: UnsupportedAddition[];
}

export function UnsupportedAdditionsList({ additions }: UnsupportedAdditionsListProps): ReactElement {
  if (additions.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleIcon />}
        title="No unsupported scope additions"
        message="Every generated capability, component and strategy element cites a reviewed requirement or assumption."
      />
    );
  }

  return (
    <ul className="stack stack-sm">
      {additions.map((addition) => (
        <li key={`${addition.targetType}-${addition.targetId}`} className="stack stack-xs">
          <p className="text-sm">{addition.reason}</p>
          {addition.unknownRefs.length > 0 ? (
            <span className="cluster">
              {addition.unknownRefs.map((ref) => (
                <Badge key={ref} tone="warning">
                  {ref}
                </Badge>
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
