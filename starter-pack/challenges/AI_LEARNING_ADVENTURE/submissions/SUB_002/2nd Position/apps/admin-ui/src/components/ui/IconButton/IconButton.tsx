import type { ButtonHTMLAttributes } from 'react';

import { cx } from '../cx';
import styles from './IconButton.module.scss';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'sm' | 'md';
  active?: boolean;
}

export function IconButton({ size = 'md', active = false, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, size === 'sm' && styles.sm, active && styles.active, className)}
      {...rest}
    />
  );
}
