/**
 * Rule CR_13: compare the calculated timeline with the configured delivery deadline and state the
 * average team size that would be needed to meet it. Uses the same scheduling rule as the timeline.
 */
import type { EstimationConfig, NumericRange } from '../../domain';
import { countOf, formatWhole } from '../format';
import type { PhaseLoad } from './timeline';
import { schedulePhases, teamCapacity } from './timeline';

/** Upper bound of the team-size search; beyond this, adding people is not a credible answer. */
export const MAX_TEAM_SIZE_SEARCHED = 60;

export interface DeadlineQuery {
  deadlineWeeks: number | null;
  timelineWeeks: NumericRange;
  loads: readonly PhaseLoad[];
  config: EstimationConfig;
  /** Open gaps/questions that keep the deadline unknown (cited when no deadline is configured). */
  relatedScopeIds: readonly string[];
}

/** Smallest average team whose likely timeline fits the deadline, or null when none up to the bound does. */
export function teamSizeForDeadline(
  loads: readonly PhaseLoad[],
  workingDaysPerWeek: number,
  deadlineWeeks: number,
): number | null {
  for (let teamSize = 1; teamSize <= MAX_TEAM_SIZE_SEARCHED; teamSize += 1) {
    const capacity = teamCapacity({ teamSize, workingDaysPerWeek });
    if (capacity > 0 && schedulePhases(loads, capacity).totalWeeks <= deadlineWeeks) {
      return teamSize;
    }
  }
  return null;
}

function teamSentence(query: DeadlineQuery, deadlineWeeks: number): string {
  const needed = teamSizeForDeadline(query.loads, query.config.workingDaysPerWeek, deadlineWeeks);
  const current = formatWhole(query.config.teamSize);
  if (needed === null) {
    return 'Adding people alone cannot meet it because the sequential phases set a minimum duration; reduce or phase the scope instead.';
  }
  if (needed <= query.config.teamSize) {
    return `The configured team of ${current} is sufficient; the smallest average team that still meets the deadline at the likely effort is ${formatWhole(needed)}.`;
  }
  return `An average team of about ${formatWhole(needed)} (currently ${current}) would be needed to meet it at the likely effort, assuming the work can be parallelised; alternatively reduce or phase the scope.`;
}

function verdict(deadlineWeeks: number, timeline: NumericRange): string {
  const deadline = `${formatWhole(deadlineWeeks)}-week deadline`;
  if (timeline.high <= deadlineWeeks) {
    return `The ${deadline} is achievable: even the high end of the timeline range (${countOf(timeline.high, 'week')}) fits, against a likely ${countOf(timeline.likely, 'week')}.`;
  }
  if (timeline.likely <= deadlineWeeks) {
    return `The ${deadline} is achievable at the likely timeline of ${countOf(timeline.likely, 'week')}, but the high end of the range (${countOf(timeline.high, 'week')}) would miss it by ${countOf(timeline.high - deadlineWeeks, 'week')}; protect the critical path and resolve the open inputs early.`;
  }
  return `The ${deadline} is at risk: the likely timeline is ${countOf(timeline.likely, 'week')}, which is ${countOf(timeline.likely - deadlineWeeks, 'week')} over (range ${formatWhole(timeline.low)} to ${formatWhole(timeline.high)} weeks).`;
}

export function assessDeadline(query: DeadlineQuery): string {
  const { timelineWeeks, deadlineWeeks } = query;
  if (teamCapacity(query.config) <= 0) {
    return 'The timeline cannot be calculated because team size and working days per week must both be above zero.';
  }
  if (deadlineWeeks === null) {
    const related = query.relatedScopeIds.length > 0 ? ` (open: ${query.relatedScopeIds.join(', ')})` : '';
    return `No delivery deadline was provided${related}, so the likely timeline of ${countOf(timelineWeeks.likely, 'week')} (range ${formatWhole(timelineWeeks.low)} to ${formatWhole(timelineWeeks.high)} weeks) has not been tested against a target date. Enter the deadline in the solution configuration to check whether a team of ${formatWhole(query.config.teamSize)} is sufficient.`;
  }
  return `${verdict(deadlineWeeks, timelineWeeks)} ${teamSentence(query, deadlineWeeks)}`;
}
