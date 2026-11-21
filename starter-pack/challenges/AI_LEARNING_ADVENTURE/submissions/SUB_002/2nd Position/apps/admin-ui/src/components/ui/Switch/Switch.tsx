import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Switch.module.scss';

export interface SwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  className
}: SwitchProps) {
  return (
    <label className={cx(styles.switch, disabled && styles.disabled, className)}>
      <input
        type="checkbox"
        role="switch"
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange?.(event.target.checked)}
        className={styles.input}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {label || description ? (
        <span className={styles.text}>
          {label ? <span className={styles.label}>{label}</span> : undefined}
          {description ? <span className={styles.description}>{description}</span> : undefined}
        </span>
      ) : undefined}
    </label>
  );
}
