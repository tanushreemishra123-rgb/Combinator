import { describe, expect, it } from 'vitest';
import type { PhaseEstimate } from '../../../domain';
import { axisStep, buildGanttLayout, WEEK_WIDTH } from './ganttLayout';

function phase(overrides: Partial<PhaseEstimate> = {}): PhaseEstimate {
  return {
    id: 'PH_1',
    name: 'Discovery and Architecture',
    workstreamIds: [],
    effortDays: { low: 8, likely: 10, high: 12 },
    durationWeeks: { low: 1, likely: 2, high: 3 },
    startWeek: 0,
    milestone: 'Discovery sign-off',
    calculation: [],
    ...overrides,
  };
}

describe('buildGanttLayout', () => {
  it('returns no bars and a minimum one-week scale for an empty phase list', () => {
    const layout = buildGanttLayout([], null);
    expect(layout.bars).toEqual([]);
    expect(layout.totalWeeks).toBe(1);
    expect(layout.deadlineX).toBeNull();
  });

  it('places each bar at its start week and sizes it by the likely duration', () => {
    const layout = buildGanttLayout([phase({ id: 'PH_1', startWeek: 0, durationWeeks: { low: 1, likely: 2, high: 3 } })], null);
    const bar = layout.bars.at(0);
    expect(bar?.x).toBe(12);
    expect(bar?.width).toBe(2 * WEEK_WIDTH);
  });

  it('scales the total width to the latest phase end week (using the high end of its range)', () => {
    const layout = buildGanttLayout([phase({ startWeek: 4, durationWeeks: { low: 2, likely: 3, high: 5 } })], null);
    expect(layout.totalWeeks).toBe(9);
  });

  it('extends the scale to cover a deadline later than every phase', () => {
    const layout = buildGanttLayout([phase({ startWeek: 0, durationWeeks: { low: 1, likely: 2, high: 3 } })], 20);
    expect(layout.totalWeeks).toBe(20);
    expect(layout.deadlineX).toBe(12 + 20 * WEEK_WIDTH);
  });

  it('never lets a deadline earlier than the phases shrink the scale', () => {
    const layout = buildGanttLayout([phase({ startWeek: 10, durationWeeks: { low: 2, likely: 3, high: 4 } })], 5);
    expect(layout.totalWeeks).toBe(14);
  });

  it('stacks bars top to bottom, one row per phase', () => {
    const layout = buildGanttLayout([phase({ id: 'PH_1' }), phase({ id: 'PH_2', startWeek: 2 })], null);
    expect(layout.bars.at(1)?.y).toBeGreaterThan(layout.bars.at(0)?.y ?? 0);
  });
});

describe('axisStep', () => {
  it('uses a fine step for short timelines', () => {
    expect(axisStep(10)).toBe(2);
  });

  it('uses a medium step for mid-length timelines', () => {
    expect(axisStep(20)).toBe(4);
  });

  it('uses a coarse step for long timelines', () => {
    expect(axisStep(60)).toBe(8);
  });
});
