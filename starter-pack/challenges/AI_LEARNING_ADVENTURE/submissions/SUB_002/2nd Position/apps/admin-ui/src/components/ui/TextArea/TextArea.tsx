import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

import { cx } from '../cx';
import styles from './TextArea.module.scss';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextArea({ label, hint, error, className, id, rows = 4, ...rest }: TextAreaProps) {
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
      <textarea
        id={inputId}
        rows={rows}
        className={cx(styles.textarea, error && styles.invalid)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
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
