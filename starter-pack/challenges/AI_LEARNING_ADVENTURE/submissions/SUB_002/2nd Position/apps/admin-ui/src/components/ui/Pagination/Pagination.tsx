import { cx } from '../cx';
import styles from './Pagination.module.scss';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  'aria-label'?: string;
}

type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

function getPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: PageItem[] = [1];
  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(pageCount - 1, page + 1);

  if (windowStart > 2) {
    items.push('start-ellipsis');
  }
  for (let current = windowStart; current <= windowEnd; current += 1) {
    items.push(current);
  }
  if (windowEnd < pageCount - 1) {
    items.push('end-ellipsis');
  }
  items.push(pageCount);

  return items;
}

export function Pagination({ page, pageCount, onPageChange, className, 'aria-label': ariaLabel = 'Pagination' }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label={ariaLabel} className={cx(styles.pagination, className)}>
      <button type="button" className={styles.button} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      {getPageItems(page, pageCount).map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            className={cx(styles.button, styles.page, item === page && styles.current)}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className={styles.ellipsis} aria-hidden="true">
            …
          </span>
        )
      )}
      <button
        type="button"
        className={styles.button}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
