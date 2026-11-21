import { useId } from 'react';

import { cx } from '../cx';
import styles from './Select.module.scss';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: SelectOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  'aria-label'?: string;
}

export function Select({
  id,
  name,
  label,
  value,
  defaultValue,
  placeholder,
  options,
  onChange,
  disabled = false,
  hint,
  error,
  className,
  'aria-label': ariaLabel
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = cx(hintId, errorId);

  return (
    <div className={cx(styles.field, className)}>
      {label ? (
        <label htmlFor={selectId} className={styles.label}>
          {label}
        </label>
      ) : undefined}
      <div className={styles.control}>
        <select
          id={selectId}
          name={name}
          className={cx(styles.select, error && styles.invalid)}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange?.(event.target.value)}
        >
          {placeholder !== undefined ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : undefined}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.chevron} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
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
