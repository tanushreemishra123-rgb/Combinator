import { teamSizeForDeadline } from './deadline';
import { schedulePhases, teamCapacity } from './timeline';
import type { PhaseLoad } from './timeline';

const LOADS: readonly PhaseLoad[] = [
  { phaseId: 'PH_1', sequence: 'lead', likelyDays: 60 },
  { phaseId: 'PH_2', sequence: 'build', likelyDays: 300 },
  { phaseId: 'PH_3', sequence: 'build', likelyDays: 200 },
  { phaseId: 'PH_5', sequence: 'overlap', likelyDays: 110 },
  { phaseId: 'PH_6', sequence: 'closing', likelyDays: 40 },
];

describe('schedulePhases', () => {
  const schedule = schedulePhases(LOADS, 30);
  const slot = (phaseId: string) => schedule.slots.find((entry) => entry.phaseId === phaseId);

  it('runs discovery first, rounded up to whole weeks', () => {
    expect(slot('PH_1')).toEqual({ phaseId: 'PH_1', startWeek: 1, durationWeeks: 2, endWeek: 2 });
  });

  it('runs the build phases concurrently over the combined build window', () => {
    expect(schedule.buildDays).toBe(500);
    expect(schedule.buildWeeks).toBe(17);
    expect(slot('PH_2')).toEqual({ phaseId: 'PH_2', startWeek: 3, durationWeeks: 17, endWeek: 19 });
    expect(slot('PH_3')).toEqual(expect.objectContaining({ startWeek: 3, endWeek: 19 }));
  });

  it('overlaps testing with the end of build and then lets it run alone', () => {
    expect(slot('PH_5')).toEqual({ phaseId: 'PH_5', startWeek: 17, durationWeeks: 4, endWeek: 20 });
  });

  it('runs deployment and handover last and totals the calendar', () => {
    expect(slot('PH_6')).toEqual({ phaseId: 'PH_6', startWeek: 21, durationWeeks: 2, endWeek: 22 });
    expect(schedule.totalWeeks).toBe(22);
  });

  it('never lets testing finish before the build window ends', () => {
    const short = schedulePhases([{ phaseId: 'PH_2', sequence: 'build', likelyDays: 600 }, { phaseId: 'PH_5', sequence: 'overlap', likelyDays: 30 }], 30);
    expect(short.slots.at(1)).toEqual({ phaseId: 'PH_5', startWeek: 21, durationWeeks: 1, endWeek: 21 });
  });

  it('yields an empty calendar when team capacity is not usable', () => {
    expect(teamCapacity({ teamSize: 0, workingDaysPerWeek: 5 })).toBe(0);
    expect(schedulePhases(LOADS, 0).totalWeeks).toBe(0);
  });
});

describe('teamSizeForDeadline', () => {
  it('finds the smallest team whose likely timeline fits', () => {
    expect(teamSizeForDeadline(LOADS, 5, 22)).toBe(6);
    expect(teamSizeForDeadline(LOADS, 5, 12)).toBeGreaterThan(6);
  });

  it('returns null when the sequential phases alone exceed the deadline', () => {
    expect(teamSizeForDeadline(LOADS, 5, 3)).toBeNull();
  });
});
