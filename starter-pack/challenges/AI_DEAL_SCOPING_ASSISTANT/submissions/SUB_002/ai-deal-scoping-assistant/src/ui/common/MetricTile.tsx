/** A single at-a-glance metric (coverage %, effort range, confidence, ...) laid out in a MetricGrid. */
import type { ReactElement, ReactNode } from 'react';

export type MetricTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export interface MetricTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: MetricTone;
  icon?: ReactNode;
}

export function MetricTile({ label, value, hint, tone = 'neutral', icon }: MetricTileProps): ReactElement {
  return (
    <div className={`metric-tile metric-tile-${tone}`}>
      {icon ? (
        <span className="metric-tile-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="metric-tile-label text-subtle text-sm">{label}</p>
      <p className="metric-tile-value">{value}</p>
      {hint ? <p className="metric-tile-hint text-muted text-xs">{hint}</p> : null}
    </div>
  );
}

export interface MetricGridProps {
  children: ReactNode;
}

export function MetricGrid({ children }: MetricGridProps): ReactElement {
  return <div className="metric-grid">{children}</div>;
}
