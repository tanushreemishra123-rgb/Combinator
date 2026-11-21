import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './ErrorState.module.scss';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = 'Something went wrong', description, action, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cx(styles.error, className)}>
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : undefined}
      {action ? <div className={styles.action}>{action}</div> : undefined}
    </div>
  );
}
