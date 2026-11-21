/**
 * Simple accessible Gantt-style bar chart of the delivery phases by week (spec 5: "Major
 * milestones"). The chart is a visual summary only - `PhasesTable` right above it already gives a
 * screen-reader a fully accessible, reproducible account of the same start weeks and durations.
 */
import type { ReactElement } from 'react';
import type { PhaseEstimate } from '../../../domain';
import { axisStep, BAR_HEIGHT, buildGanttLayout, WEEK_WIDTH } from './ganttLayout';

export interface GanttChartProps {
  phases: PhaseEstimate[];
  deadlineWeeks: number | null;
}

function WeekAxis({ totalWeeks, padding = 12 }: { totalWeeks: number; padding?: number }): ReactElement {
  const step = axisStep(totalWeeks);
  const ticks: number[] = [];
  for (let week = 0; week <= totalWeeks; week += step) {
    ticks.push(week);
  }
  return (
    <g className="gantt-axis">
      {ticks.map((week) => (
        <text key={week} x={padding + week * WEEK_WIDTH} y={10} className="gantt-axis-label" textAnchor="middle">
          {week}
        </text>
      ))}
    </g>
  );
}

export function GanttChart({ phases, deadlineWeeks }: GanttChartProps): ReactElement | null {
  if (phases.length === 0) {
    return null;
  }
  const layout = buildGanttLayout(phases, deadlineWeeks);
  const summary = `Gantt chart of ${phases.length} delivery phases across ${layout.totalWeeks} weeks${deadlineWeeks === null ? '' : `, with the ${deadlineWeeks}-week deadline marked`}.`;

  return (
    <div className="gantt-scroll">
      <svg role="img" aria-label={summary} className="gantt-chart" viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <WeekAxis totalWeeks={layout.totalWeeks} />
        {layout.bars.map((bar) => (
          <g key={bar.id}>
            <rect x={bar.x} y={bar.y} width={bar.width} height={BAR_HEIGHT} rx={4} className="gantt-bar" />
            <text x={bar.x + 6} y={bar.y + BAR_HEIGHT / 2 + 4} className="gantt-bar-label">
              {bar.name}
            </text>
          </g>
        ))}
        {layout.deadlineX !== null ? (
          <g className="gantt-deadline">
            <line x1={layout.deadlineX} y1={0} x2={layout.deadlineX} y2={layout.height} />
            <text x={layout.deadlineX + 4} y={layout.height - 4}>
              Deadline
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
