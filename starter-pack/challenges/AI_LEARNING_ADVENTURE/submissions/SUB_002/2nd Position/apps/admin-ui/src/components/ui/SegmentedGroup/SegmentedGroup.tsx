import type { ReactNode } from 'react';

import { cx } from '../cx';
import styles from './SegmentedGroup.module.scss';

export interface SegmentedOption {
  label: ReactNode;
  value: string;
  disabled?: boolean;
}

export interface SegmentedGroupProps {
  value: string;
  onChange?: (value: string) => void;
  options: SegmentedOption[];
  size?: 'sm' | 'md';
  'aria-label'?: string;
  className?: string;
}

export function SegmentedGroup({
  value,
  onChange,
  options,
  size = 'md',
  'aria-label': ariaLabel,
  className
}: SegmentedGroupProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx(styles.group, styles[size] /* nosemgrep: gitlab.eslint.detect-object-injection */, className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange?.(option.value)}
            className={cx(styles.segment, active && styles.active)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
