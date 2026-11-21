import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './TextInput.module.scss';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  rightMeta?: ReactNode;
}

export function TextInput({ label, hint, error, rightMeta, className, id, ...rest }: TextInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = cx(hintId, errorId);

  return (
    <div className={cx(styles.field, className)}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      ) : undefined}
      <div className={styles.row}>
        <input
          id={inputId}
          className={cx(styles.input, error && styles.invalid)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...rest}
        />
        {rightMeta ? <span className={styles.meta}>{rightMeta}</span> : undefined}
      </div>
      {hint && !error ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : undefined}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : undefined}
    </div>
  );
}
