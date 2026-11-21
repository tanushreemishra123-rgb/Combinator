/**
 * Configurable data table: caller-supplied column renderers, a sticky header, a horizontally
 * scrollable wrapper for narrow screens, an empty state, and optional per-row expansion.
 */
import { Fragment, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from './icons';
import { IconButton } from './IconButton';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'start' | 'end' | 'center';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyState?: ReactNode;
  /** When provided, every row gets an expand toggle that reveals this content beneath it. */
  renderExpanded?: (row: T) => ReactNode;
  caption?: string;
}

function toggleMembership(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function DataTable<T>({ columns, rows, getRowId, emptyState, renderExpanded, caption }: DataTableProps<T>): ReactElement {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  if (rows.length === 0) {
    return <div className="data-table-empty">{emptyState ?? <EmptyState title="No data" message="Nothing to show yet." />}</div>;
  }

  return (
    <div className="data-table-scroll">
      <table className="data-table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {renderExpanded ? (
              <th scope="col" className="data-table-expand-col">
                <span className="sr-only">Expand row</span>
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.id} scope="col" style={column.width ? { width: column.width } : undefined} className={`align-${column.align ?? 'start'}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const isExpanded = expandedIds.has(id);
            return (
              <Fragment key={id}>
                <tr>
                  {renderExpanded ? (
                    <td className="data-table-expand-col">
                      <IconButton
                        label={isExpanded ? 'Collapse row' : 'Expand row'}
                        icon={isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        size="sm"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedIds((prev) => toggleMembership(prev, id))}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.id} className={`align-${column.align ?? 'start'}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
                {renderExpanded && isExpanded ? (
                  <tr className="data-table-expanded-row">
                    <td colSpan={columns.length + 1}>{renderExpanded(row)}</td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
