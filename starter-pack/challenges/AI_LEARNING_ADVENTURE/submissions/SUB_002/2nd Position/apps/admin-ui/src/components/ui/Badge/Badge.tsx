import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Badge.module.scss';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'neutral' | 'draft' | 'published' | 'disabled';

export interface BadgeProps {
  variant?: BadgeVariant;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', mono = false, className, children }: BadgeProps) {
  return <span className={cx(styles.badge, styles[variant] /* nosemgrep: gitlab.eslint.detect-object-injection */, mono && styles.mono, className)}>{children}</span>;
}
