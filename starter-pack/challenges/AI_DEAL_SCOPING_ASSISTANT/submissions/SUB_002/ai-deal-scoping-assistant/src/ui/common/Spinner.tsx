/** A small animated spinner, and a BusyOverlay that dims its content while `active`. */
import type { ReactElement, ReactNode } from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  /** Accessible label read by assistive tech; the spinner itself is purely visual. */
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps): ReactElement {
  return (
    <span className={`spinner spinner-${size}`} role="status">
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface BusyOverlayProps {
  active: boolean;
  label?: string;
  children: ReactNode;
}

/** Wraps content with a translucent overlay and spinner while a long-running action is in flight. */
export function BusyOverlay({ active, label = 'Working...', children }: BusyOverlayProps): ReactElement {
  return (
    <div className="busy-overlay-wrapper" aria-busy={active}>
      {children}
      {active ? (
        <div className="busy-overlay" role="status" aria-live="polite">
          <Spinner size="md" label={label} />
          <span className="busy-overlay-label">{label}</span>
        </div>
      ) : null}
    </div>
  );
}
