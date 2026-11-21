import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './AttentionStrip.module.scss';

export type AttentionSeverity = 'warning' | 'danger';

export interface AttentionItem {
  id: string;
  message: ReactNode;
  severity?: AttentionSeverity;
  href?: string;
  onClick?: () => void;
}

export interface AttentionStripProps {
  title?: string;
  items: AttentionItem[];
  className?: string;
}

export function AttentionStrip({ title = 'Needs attention', items, className }: AttentionStripProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label={title} className={cx(styles.strip, className)}>
      <span className={styles.title}>{title}</span>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={cx(styles.item, styles[item.severity ?? 'warning'] /* nosemgrep: gitlab.eslint.detect-object-injection */)}>
            <span className={styles.marker} aria-hidden="true" />
            {item.href ? (
              <a href={item.href} className={styles.link}>
                {item.message}
              </a>
            ) : item.onClick ? (
              <button type="button" className={styles.link} onClick={item.onClick}>
                {item.message}
              </button>
            ) : (
              <span>{item.message}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
