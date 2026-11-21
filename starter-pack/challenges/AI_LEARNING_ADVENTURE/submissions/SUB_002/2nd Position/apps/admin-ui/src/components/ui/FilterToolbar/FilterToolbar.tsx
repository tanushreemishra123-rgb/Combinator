import type { HTMLAttributes } from 'react';

import { cx } from '../cx';
import styles from './FilterToolbar.module.scss';

export interface FilterToolbarProps extends HTMLAttributes<HTMLDivElement> {}

export function FilterToolbar({ className, children, ...rest }: FilterToolbarProps) {
  return (
    <div className={cx(styles.toolbar, className)} {...rest}>
      {children}
    </div>
  );
}
