/** Warns that a generated section is out of date after an upstream change, listing why and offering the fix. */
import type { ReactElement } from 'react';
import { Button } from './Button';
import { AlertTriangleIcon, RefreshIcon } from './icons';

export interface StaleBannerProps {
  reasons: string[];
  actionLabel: string;
  onAction: () => void;
}

export function StaleBanner({ reasons, actionLabel, onAction }: StaleBannerProps): ReactElement {
  return (
    <div className="stale-banner" role="status">
      <AlertTriangleIcon />
      <div className="stale-banner-body">
        <p className="stale-banner-title">This section is out of date</p>
        {reasons.length > 0 ? (
          <ul className="stale-banner-reasons">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button variant="secondary" size="sm" icon={<RefreshIcon />} onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
