import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : undefined}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : undefined}
      {action ? <div className={styles.action}>{action}</div> : undefined}
    </div>
  );
}
