import type { DashboardSummary } from '../hooks/useProgressDashboard.ts';

export interface ProgressSummaryProps {
  summary: DashboardSummary;
  currentLevelLabel: string;
}

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressSummary({ summary, currentLevelLabel }: ProgressSummaryProps) {
  const dashOffset = RING_CIRCUMFERENCE * (1 - summary.completionPercent / 100);

  return (
    <section className="progress-summary" aria-label="Progress summary">
      <div className="progress-summary__stat progress-summary__stat--ring">
        <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden="true" focusable="false">
          <circle
            cx="40"
            cy="40"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="progress-summary__ring-track"
          />
          <circle
            cx="40"
            cy="40"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 40 40)"
            className="progress-summary__ring-fill"
          />
        </svg>
        <span className="progress-summary__ring-label">{summary.completionPercent}%</span>
        <span className="progress-summary__caption">Complete</span>
      </div>
      <div className="progress-summary__stat">
        <span className="progress-summary__value">
          {summary.completedCount}
          <span className="progress-summary__denominator"> / {summary.totalCount}</span>
        </span>
        <span className="progress-summary__caption">Missions completed</span>
      </div>
      <div className="progress-summary__stat">
        <span className="progress-summary__value">{currentLevelLabel}</span>
        <span className="progress-summary__caption">Current level</span>
      </div>
      <div className="progress-summary__stat">
        <span className="progress-summary__value">{summary.badgeCount}</span>
        <span className="progress-summary__caption">Badges earned</span>
      </div>
    </section>
  );
}
