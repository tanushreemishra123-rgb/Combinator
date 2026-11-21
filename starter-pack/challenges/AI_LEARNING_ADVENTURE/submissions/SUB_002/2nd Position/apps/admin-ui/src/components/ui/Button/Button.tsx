import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = 'outline',
  size = 'md',
  iconLeft,
  iconRight,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant] /* nosemgrep: gitlab.eslint.detect-object-injection */, styles[size], className)} {...rest}>
      {iconLeft ? (
        <span className={styles.icon} aria-hidden="true">
          {iconLeft}
        </span>
      ) : undefined}
      {children !== undefined && children !== null ? <span className={styles.label}>{children}</span> : undefined}
      {iconRight ? (
        <span className={styles.icon} aria-hidden="true">
          {iconRight}
        </span>
      ) : undefined}
    </button>
  );
}
