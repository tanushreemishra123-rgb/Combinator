/**
 * The structured scope model table (spec "Recommended Application Sections 1"). Built directly on
 * a `<table>` rather than the shared `DataTable` - unlike `DataTable`, this list needs a scroll-into-
 * view + highlight target per row for cross-workspace navigation focus, which `DataTable` does not
 * expose (composed locally rather than widening the shared component for one caller).
 */
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { Priority, ReviewStatus, ScopeItem } from '../../../domain';
import { EmptyState } from '../../common';
import { ScopeItemRow } from './ScopeItemRow';

export interface ScopeItemsTableProps {
  items: readonly ScopeItem[];
  highlightedId: string | null;
  onOpenSource: (item: ScopeItem) => void;
  onSelectRelated: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onInScopeChange: (id: string, inScope: boolean) => void;
  onReview: (id: string, review: ReviewStatus) => void;
  onEdit: (item: ScopeItem) => void;
  onDelete: (item: ScopeItem) => void;
}

const COLUMN_HEADERS = ['ID', 'Type', 'Title and description', 'Priority', 'Provenance', 'Source', 'Related', 'In scope', 'Review', 'Actions'];

export function ScopeItemsTable(props: ScopeItemsTableProps): ReactElement {
  const { items, highlightedId } = props;
  const rowElements = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (highlightedId === null) {
      return;
    }
    rowElements.current.get(highlightedId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedId]);

  if (items.length === 0) {
    return <EmptyState title="No items match these filters" message="Try a different kind group, or clear the provenance, priority, review or search filters." />;
  }

  return (
    <div className="data-table-scroll">
      <table className="data-table" aria-label="Structured scope items">
        <thead>
          <tr>
            {COLUMN_HEADERS.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ScopeItemRow
              key={item.id}
              item={item}
              isHighlighted={item.id === highlightedId}
              rowRef={(element) => {
                if (element) {
                  rowElements.current.set(item.id, element);
                } else {
                  rowElements.current.delete(item.id);
                }
              }}
              onOpenSource={props.onOpenSource}
              onSelectRelated={props.onSelectRelated}
              onPriorityChange={props.onPriorityChange}
              onInScopeChange={props.onInScopeChange}
              onReview={props.onReview}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
