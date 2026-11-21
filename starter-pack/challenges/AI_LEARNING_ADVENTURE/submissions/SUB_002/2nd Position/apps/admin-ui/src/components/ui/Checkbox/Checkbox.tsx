import { useEffect, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Checkbox.module.scss';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
}

export function Checkbox({ label, description, indeterminate = false, className, id, ...rest }: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className={cx(styles.checkbox, className)}>
      <input
        ref={inputRef}
        type="checkbox"
        id={id}
        aria-label={typeof label === 'string' ? label : undefined}
        className={styles.input}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar') {
            e.preventDefault();
            e.currentTarget.click();
          }
          rest.onKeyDown?.(e);
        }}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
