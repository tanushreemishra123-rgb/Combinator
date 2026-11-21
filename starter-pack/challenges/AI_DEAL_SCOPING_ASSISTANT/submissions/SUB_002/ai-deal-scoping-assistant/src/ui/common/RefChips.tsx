/**
 * Renders a list of scope-model IDs as clickable chips. Collapses long lists behind a
 * '+k more' expander instead of ever silently truncating the references.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';

export interface RefChipsProps {
  refs: string[];
  onSelect?: (id: string) => void;
  max?: number;
  emptyLabel?: string;
}

export function RefChips({ refs, onSelect, max = 6, emptyLabel = 'No references' }: RefChipsProps): ReactElement {
  const [expanded, setExpanded] = useState(false);

  if (refs.length === 0) {
    return <span className="ref-chips-empty text-subtle text-sm">{emptyLabel}</span>;
  }

  const visible = expanded ? refs : refs.slice(0, max);
  const hiddenCount = refs.length - visible.length;

  return (
    <span className="ref-chips">
      {visible.map((ref) => (
        <button
          key={ref}
          type="button"
          className="ref-chip"
          onClick={onSelect ? () => onSelect(ref) : undefined}
          disabled={!onSelect}
        >
          {ref}
        </button>
      ))}
      {hiddenCount > 0 ? (
        <button type="button" className="ref-chip ref-chip-more" onClick={() => setExpanded(true)}>
          +{hiddenCount} more
        </button>
      ) : null}
    </span>
  );
}
