import { useState } from 'react';
import type { ScorePoint } from '@ai-learning-adventure/learner';

export interface ScoreHistoryProps {
  points: ScorePoint[];
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;
const CHART_PADDING = 12;

function xFor(index: number, count: number): number {
  if (count <= 1) return CHART_WIDTH / 2;
  const usable = CHART_WIDTH - CHART_PADDING * 2;
  return CHART_PADDING + (usable * index) / (count - 1);
}

function yFor(scorePercent: number): number {
  const usable = CHART_HEIGHT - CHART_PADDING * 2;
  return CHART_HEIGHT - CHART_PADDING - (usable * scorePercent) / 100;
}

export function ScoreHistory({ points }: ScoreHistoryProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (points.length === 0) {
    return (
      <section className="score-history" aria-label="Scores over time">
        <h2 className="progress-panel__heading">Scores over time</h2>
        <p className="score-history__empty">No quiz attempts yet — your scores will appear here.</p>
      </section>
    );
  }

  const active = activeIndex !== undefined ? points[activeIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */ : undefined;
  const linePoints = points
    .map((point, index) => `${xFor(index, points.length)},${yFor(point.scorePercent)}`)
    .join(' ');
  const bestScore = points.reduce((best, point) => Math.max(best, point.scorePercent), 0);

  return (
    <section className="score-history" aria-label="Scores over time">
      <h2 className="progress-panel__heading">Scores over time</h2>
      <div className="score-history__chart-wrap">
        <svg
          className="score-history__chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`Score history: ${points.length} attempts, best score ${bestScore}%.`}
        >
          <polyline
            points={linePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="score-history__line"
          />
          {points.map((point, index) => (
            <circle
              key={point.attemptId}
              cx={xFor(index, points.length)}
              cy={yFor(point.scorePercent)}
              r={activeIndex === index ? 7 : 5}
              tabIndex={0}
              className="score-history__point"
              aria-label={`${point.scorePercent}% on ${new Date(point.completedAt).toLocaleDateString()}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(undefined)}
            />
          ))}
        </svg>
        {active !== undefined && (
          <p className="score-history__tooltip" role="status">
            {active.scorePercent}% · {new Date(active.completedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </section>
  );
}
