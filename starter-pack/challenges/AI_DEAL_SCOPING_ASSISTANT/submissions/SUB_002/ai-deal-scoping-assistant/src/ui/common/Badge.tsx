/** Generic coloured pill. The more specific badges (ProvenanceBadge, PriorityBadge, ...) are built on this. */
import type { ReactElement, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'teal';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps): ReactElement {
  const classes = ['badge', `badge-${tone}`, className].filter((value) => Boolean(value)).join(' ');
  return (
    <span className={classes}>
      {icon ? (
        <span className="badge-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
