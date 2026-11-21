import { useCallback, useEffect, useRef, useState } from 'react';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cx } from '../cx';
import styles from './Table.module.scss';

export type TableCellAlign = 'left' | 'center' | 'right';
export type TableSortDirection = 'asc' | 'desc';

export interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {}

export function TableContainer({ className, children, ...rest }: TableContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    window.addEventListener('resize', updateScrollIndicators);
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      window.removeEventListener('resize', updateScrollIndicators);
    };
  }, [updateScrollIndicators]);

  return (
    <div
      ref={scrollRef}
      className={cx(
        styles.container,
        canScrollLeft && styles.scrollableLeft,
        canScrollRight && styles.scrollableRight,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  minWidth?: string | number;
}

export function Table({ className, minWidth, children, ...rest }: TableProps) {
  return (
    <table
      className={cx(styles.table, className)}
      style={minWidth !== undefined ? { minWidth } : undefined}
      {...rest}
    >
      {children}
    </table>
  );
}

export function TableHead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cx(styles.head, className)} {...rest}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cx(styles.body, className)} {...rest}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

export function TableRow({ hoverable = true, selected = false, disabled = false, className, children, ...rest }: TableRowProps) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cx(
        styles.row,
        hoverable && styles.hoverable,
        selected && styles.selected,
        disabled && styles.disabled,
        className
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: TableCellAlign;
  sortable?: boolean;
  sorted?: TableSortDirection | null;
  onSort?: () => void;
}

export function TableHeaderCell({
  align = 'left',
  sortable = false,
  sorted = null,
  onSort,
  className,
  children,
  ...rest
}: TableHeaderCellProps) {
  const ariaSort = sortable
    ? sorted === 'asc'
      ? 'ascending'
      : sorted === 'desc'
        ? 'descending'
        : 'none'
    : undefined;

  return (
    <th scope="col" aria-sort={ariaSort} className={cx(styles.headerCell, styles[`align-${align}`] /* nosemgrep: gitlab.eslint.detect-object-injection */, className)} {...rest}>
      {sortable ? (
        <button type="button" className={styles.sortButton} onClick={onSort} disabled={!onSort}>
          <span>{children}</span>
          <span className={styles.sortIndicator} aria-hidden="true">
            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↑↓'}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: TableCellAlign;
  mono?: boolean;
}

export function TableCell({ align = 'left', mono = false, className, children, ...rest }: TableCellProps) {
  return (
    <td className={cx(styles.cell, styles[`align-${align}`] /* nosemgrep: gitlab.eslint.detect-object-injection */, mono && styles.mono, className)} {...rest}>
      {children}
    </td>
  );
}
