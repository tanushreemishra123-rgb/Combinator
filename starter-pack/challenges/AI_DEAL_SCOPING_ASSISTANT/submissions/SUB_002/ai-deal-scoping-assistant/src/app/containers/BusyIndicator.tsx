/** Slim top-of-viewport progress bar announcing the current busy label, in addition to the header's inline text. */
import type { ReactElement } from 'react';
import { useBusy } from '../../state';

export function BusyIndicator(): ReactElement | null {
  const busy = useBusy();

  if (busy === null) {
    return null;
  }

  return (
    <div className="busy-indicator" role="status" aria-live="polite">
      <span className="busy-indicator-bar" aria-hidden="true" />
      <span className="sr-only">{busy.label}</span>
    </div>
  );
}
