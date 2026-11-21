/**
 * Rule CR_12: effort becomes calendar time through team capacity. Discovery runs first, the build
 * phases run concurrently and share the team, testing overlaps the end of the build window and
 * then runs alone, and the closing phases run last. Durations are rounded up to whole weeks.
 */
import type { Confidence, ConfidenceSpread, EstimationConfig, NumericRange, PhaseEstimate, WorkstreamEstimate } from '../../domain';
import { countOf, formatDecimal, formatPct, formatWhole, joinList } from '../format';
import { phaseName } from '../phases';
import { distinct } from '../scopeFacts';
import { ceilWhole, spreadRange, sum, sumRanges } from './numbers';

/** Testing and Hardening may start once this share of the build window remains (in-sprint testing). */
export const TESTING_OVERLAP_OF_BUILD = 0.25;

export type PhaseSequence = 'lead' | 'build' | 'overlap' | 'closing';

export interface PhaseLoad {
  phaseId: string;
  sequence: PhaseSequence;
  likelyDays: number;
}

export interface PhaseSlot {
  phaseId: string;
  startWeek: number;
  durationWeeks: number;
  endWeek: number;
}

export interface Schedule {
  slots: PhaseSlot[];
  totalWeeks: number;
  buildDays: number;
  buildWeeks: number;
}

const OVERHEAD_SEQUENCE: ReadonlyMap<string, PhaseSequence> = new Map<string, PhaseSequence>([
  ['PH_1', 'lead'],
  ['PH_5', 'overlap'],
]);

const MILESTONES: ReadonlyMap<string, string> = new Map([
  ['PH_1', 'Solution blueprint, prioritised backlog and delivery plan approved'],
  ['PH_2', 'Core platform and user experience feature-complete'],
  ['PH_3', 'Integrations and data pipelines verified end to end'],
  ['PH_4', 'AI capabilities meet the agreed evaluation thresholds'],
  ['PH_5', 'Test exit: acceptance, security and performance criteria met'],
  ['PH_6', 'Production go-live and handover to operations complete'],
]);

export function teamCapacity(config: Pick<EstimationConfig, 'teamSize' | 'workingDaysPerWeek'>): number {
  const capacity = config.teamSize * config.workingDaysPerWeek;
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
}

function sequenceOf(phaseId: string, overheadPhaseIds: ReadonlySet<string>): PhaseSequence {
  if (!overheadPhaseIds.has(phaseId)) {
    return 'build';
  }
  return OVERHEAD_SEQUENCE.get(phaseId) ?? 'closing';
}

/** Places every phase on the calendar; week numbers are 1-based and inclusive. */
export function schedulePhases(loads: readonly PhaseLoad[], capacityDaysPerWeek: number): Schedule {
  const weeksFor = (days: number): number =>
    capacityDaysPerWeek > 0 && days > 0 ? ceilWhole(days / capacityDaysPerWeek) : 0;
  const slots = new Map<string, PhaseSlot>();
  let cursor = 0;
  const runAfterCursor = (load: PhaseLoad): void => {
    const durationWeeks = weeksFor(load.likelyDays);
    slots.set(load.phaseId, { phaseId: load.phaseId, startWeek: cursor + 1, durationWeeks, endWeek: cursor + durationWeeks });
    cursor += durationWeeks;
  };
  loads.filter((load) => load.sequence === 'lead').forEach(runAfterCursor);
  const buildLoads = loads.filter((load) => load.sequence === 'build');
  const buildDays = sum(buildLoads.map((load) => load.likelyDays));
  const buildWeeks = weeksFor(buildDays);
  for (const load of buildLoads) {
    slots.set(load.phaseId, { phaseId: load.phaseId, startWeek: cursor + 1, durationWeeks: buildWeeks, endWeek: cursor + buildWeeks });
  }
  const buildEnd = cursor + buildWeeks;
  cursor = buildEnd;
  for (const load of loads.filter((entry) => entry.sequence === 'overlap')) {
    const durationWeeks = weeksFor(load.likelyDays);
    const overlapWeeks = Math.min(Math.max(durationWeeks - 1, 0), Math.floor(buildWeeks * TESTING_OVERLAP_OF_BUILD));
    const startWeek = buildEnd - overlapWeeks + 1;
    const endWeek = startWeek + durationWeeks - 1;
    slots.set(load.phaseId, { phaseId: load.phaseId, startWeek, durationWeeks, endWeek });
    cursor = Math.max(cursor, endWeek);
  }
  loads.filter((load) => load.sequence === 'closing').forEach(runAfterCursor);
  const ordered = loads.flatMap((load) => slots.get(load.phaseId) ?? []);
  return { slots: ordered, totalWeeks: cursor, buildDays, buildWeeks };
}

/** One load per phase, in phase order, from the likely effort of its workstreams. */
export function phaseLoads(workstreams: readonly WorkstreamEstimate[], overheadPhaseIds: ReadonlySet<string>): PhaseLoad[] {
  return distinct(workstreams.map((workstream) => workstream.phaseId)).map((phaseId) => ({
    phaseId,
    sequence: sequenceOf(phaseId, overheadPhaseIds),
    likelyDays: sum(workstreams.filter((ws) => ws.phaseId === phaseId).map((ws) => ws.effortDays.likely)),
  }));
}

function durationLine(load: PhaseLoad, slot: PhaseSlot, schedule: Schedule, capacity: number): string {
  if (capacity <= 0) {
    return 'Duration cannot be calculated: team size and working days per week must both be above zero';
  }
  const perWeek = `${formatWhole(capacity)} person-days per week`;
  if (load.sequence === 'build') {
    return `Build window = combined build effort ${formatWhole(schedule.buildDays)} days / ${perWeek} = ${formatDecimal(schedule.buildDays / capacity)} -> ${countOf(schedule.buildWeeks, 'week')} (rounded up); the build phases run concurrently and share the team`;
  }
  const own = `Duration = ${formatWhole(load.likelyDays)} days / ${perWeek} = ${formatDecimal(load.likelyDays / capacity)} -> ${countOf(slot.durationWeeks, 'week')} (rounded up)`;
  if (load.sequence === 'overlap') {
    return `${own}; it may overlap up to ${formatPct(TESTING_OVERLAP_OF_BUILD * 100)} of the build window and always finishes with at least one week after build`;
  }
  return own;
}

function calendarLine(slot: PhaseSlot): string {
  return slot.durationWeeks > 0
    ? `Runs from week ${formatWhole(slot.startWeek)} to week ${formatWhole(slot.endWeek)}`
    : 'No calendar time is scheduled because the phase has no effort';
}

/** Build phases share one concurrent window (rule CR_12), so their own milestone says so rather than implying a dedicated schedule. */
function concurrencyNote(sequence: PhaseSequence): string {
  return sequence === 'build'
    ? ' - runs concurrently with the other build-phase workstreams inside the shared build window, not as a separate schedule'
    : '';
}

function milestoneFor(phaseId: string, name: string, slot: PhaseSlot, sequence: PhaseSequence): string {
  const text = MILESTONES.get(phaseId) ?? `${name} complete`;
  const suffix = concurrencyNote(sequence);
  return slot.durationWeeks > 0 ? `${text} (end of week ${formatWhole(slot.endWeek)})${suffix}` : `${text}${suffix}`;
}

export interface TimelineQuery {
  workstreams: readonly WorkstreamEstimate[];
  overheadPhaseIds: ReadonlySet<string>;
  config: EstimationConfig;
  confidence: Confidence;
  spread: ConfidenceSpread;
}

export interface Timeline {
  phases: PhaseEstimate[];
  timelineWeeks: NumericRange;
  loads: PhaseLoad[];
}

function weeksRange(likely: number, spread: ConfidenceSpread): NumericRange {
  return spreadRange(likely, spread, ceilWhole);
}

export function buildTimeline(query: TimelineQuery): Timeline {
  const { workstreams, config, spread } = query;
  const capacity = teamCapacity(config);
  const loads = phaseLoads(workstreams, query.overheadPhaseIds);
  const schedule = schedulePhases(loads, capacity);
  const spreadText = `${query.confidence} timeline confidence -${formatPct(spread.lowPct)} / +${formatPct(spread.highPct)}`;
  const phases = loads.flatMap((load): PhaseEstimate[] => {
    const slot = schedule.slots.find((entry) => entry.phaseId === load.phaseId);
    if (slot === undefined) {
      return [];
    }
    const own = workstreams.filter((workstream) => workstream.phaseId === load.phaseId);
    const name = phaseName(load.phaseId, own.at(0)?.name ?? load.phaseId);
    const effortDays = sumRanges(own.map((workstream) => workstream.effortDays));
    const durationWeeks = weeksRange(slot.durationWeeks, spread);
    return [
      {
        id: load.phaseId,
        name,
        workstreamIds: own.map((workstream) => workstream.id),
        effortDays,
        durationWeeks,
        startWeek: slot.startWeek,
        milestone: milestoneFor(load.phaseId, name, slot, load.sequence),
        calculation: [
          `Effort = ${joinList(own.map((ws) => ws.id))} = ${formatWhole(effortDays.likely)} days likely (range ${formatWhole(effortDays.low)} to ${formatWhole(effortDays.high)})`,
          `Team capacity = ${formatDecimal(config.teamSize)} people x ${formatDecimal(config.workingDaysPerWeek)} working days = ${formatDecimal(capacity)} person-days per week`,
          durationLine(load, slot, schedule, capacity),
          calendarLine(slot),
          `Duration range (${spreadText}, rounded up) = ${formatWhole(durationWeeks.low)} to ${formatWhole(durationWeeks.high)} weeks`,
        ],
      },
    ];
  });
  return { phases, timelineWeeks: weeksRange(schedule.totalWeeks, spread), loads };
}
