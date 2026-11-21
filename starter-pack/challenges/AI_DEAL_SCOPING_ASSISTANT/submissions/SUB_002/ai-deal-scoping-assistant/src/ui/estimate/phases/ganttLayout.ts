/**
 * Pure pixel layout for the phases Gantt chart, kept separate from the SVG component so the
 * geometry rule (weeks -> x/width, where the deadline marker lands) is unit-testable without
 * rendering anything.
 */
import type { PhaseEstimate } from '../../../domain';

export const WEEK_WIDTH = 22;
const BAR_HEIGHT = 22;
const BAR_GAP = 12;
const PADDING = 12;
const LABEL_HEIGHT = 20;

export interface GanttBar {
  id: string;
  name: string;
  milestone: string;
  x: number;
  y: number;
  width: number;
}

export interface GanttLayout {
  bars: GanttBar[];
  /** Highest week shown on the axis, including the deadline when it falls later than every phase. */
  totalWeeks: number;
  /** x position of the deadline marker, or null when no deadline is configured. */
  deadlineX: number | null;
  width: number;
  height: number;
}

/** Widest of every phase's own end week, so a phase past its likely duration still fits on the chart. */
function latestPhaseWeek(phases: readonly PhaseEstimate[]): number {
  return phases.reduce((max, phase) => Math.max(max, phase.startWeek + phase.durationWeeks.high), 0);
}

export function buildGanttLayout(phases: readonly PhaseEstimate[], deadlineWeeks: number | null): GanttLayout {
  const totalWeeks = Math.max(1, latestPhaseWeek(phases), deadlineWeeks ?? 0);
  const bars: GanttBar[] = phases.map((phase, index) => ({
    id: phase.id,
    name: phase.name,
    milestone: phase.milestone,
    x: PADDING + phase.startWeek * WEEK_WIDTH,
    y: PADDING + LABEL_HEIGHT + index * (BAR_HEIGHT + BAR_GAP),
    width: Math.max(WEEK_WIDTH / 2, phase.durationWeeks.likely * WEEK_WIDTH),
  }));
  return {
    bars,
    totalWeeks,
    deadlineX: deadlineWeeks === null ? null : PADDING + deadlineWeeks * WEEK_WIDTH,
    width: PADDING * 2 + totalWeeks * WEEK_WIDTH,
    height: PADDING * 2 + LABEL_HEIGHT + phases.length * (BAR_HEIGHT + BAR_GAP),
  };
}

export { BAR_HEIGHT };

/** Wider timelines get coarser week ticks so the axis never becomes a wall of numbers. */
export function axisStep(totalWeeks: number): number {
  if (totalWeeks > 40) {
    return 8;
  }
  return totalWeeks > 16 ? 4 : 2;
}

