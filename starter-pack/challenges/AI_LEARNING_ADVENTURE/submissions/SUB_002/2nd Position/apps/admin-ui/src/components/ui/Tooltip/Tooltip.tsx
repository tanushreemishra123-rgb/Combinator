import { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { cx } from '../cx';
import styles from './Tooltip.module.scss';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

export function Tooltip({ content, side = 'top', children }: TooltipProps) {
  const id = useId();

  return (
    <span className={cx(styles.tooltip, styles[side] /* nosemgrep: gitlab.eslint.detect-object-injection */)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className={styles.bubble}>
        {content}
      </span>
    </span>
  );
}
