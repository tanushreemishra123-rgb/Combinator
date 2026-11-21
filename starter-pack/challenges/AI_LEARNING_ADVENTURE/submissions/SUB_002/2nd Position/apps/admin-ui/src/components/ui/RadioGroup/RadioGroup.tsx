import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './RadioGroup.module.scss';

export interface RadioOption {
  label: ReactNode;
  value: string;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  label?: ReactNode;
  value?: string;
  defaultValue?: string;
  options: RadioOption[];
  onChange?: (value: string) => void;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  name,
  label,
  value,
  defaultValue,
  options,
  onChange,
  orientation = 'vertical',
  disabled = false,
  className
}: RadioGroupProps) {
  return (
    <fieldset
      role="radiogroup"
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      className={cx(styles.group, styles[orientation] /* nosemgrep: gitlab.eslint.detect-object-injection */, className)}
    >
      {label ? <legend className={styles.legend}>{label}</legend> : undefined}
      {options.map((option) => (
        <label key={option.value} className={cx(styles.option, option.disabled && styles.optionDisabled)}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value !== undefined ? value === option.value : undefined}
            defaultChecked={defaultValue !== undefined ? defaultValue === option.value : undefined}
            disabled={disabled || option.disabled}
            onChange={() => onChange?.(option.value)}
            className={styles.input}
          />
          <span className={styles.dot} aria-hidden="true" />
          {option.label || option.description ? (
            <span className={styles.text}>
              {option.label ? <span className={styles.optionLabel}>{option.label}</span> : undefined}
              {option.description ? <span className={styles.description}>{option.description}</span> : undefined}
            </span>
          ) : undefined}
        </label>
      ))}
    </fieldset>
  );
}
