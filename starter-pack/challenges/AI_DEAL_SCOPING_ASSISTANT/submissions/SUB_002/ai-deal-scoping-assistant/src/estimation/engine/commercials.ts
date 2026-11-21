/**
 * Rules CR_08, CR_10 and CR_11: effort range, workstream cost and ROM commercials.
 * A role without a day rate blocks the cost (null) - a rate is never assumed.
 */
import type {
  ConfidenceSpread,
  EstimateTotals,
  EstimationConfig,
  MoneyRange,
  NumericRange,
  RoleAllocation,
  WorkstreamEstimate,
} from '../../domain';
import { formatMoney, formatPct, formatTenths, formatWhole, joinList } from '../format';
import type { ConfigLookups } from './lookups';
import type { ConfidenceAssessment, WorkstreamDraft } from './model';
import { pctOf, roundTenths, roundToUnit, roundWhole, spreadRange, sum, sumRanges } from './numbers';

function spreadLabel(spread: ConfidenceSpread): string {
  return `-${formatPct(spread.lowPct)} / +${formatPct(spread.highPct)}`;
}

/** 'Effort x role day rates (USD) + 15% contingency, rounded to 1,000'. */
export function commercialBasis(config: EstimationConfig): string {
  return `Effort x role day rates (${config.currency}) + ${formatPct(config.contingencyPct)} contingency, rounded to ${formatWhole(config.roundingUnit)}`;
}

/** Why a workstream has no cost: unpriced roles, unsized drivers or effort without a role mix. */
function blockedBasis(draft: WorkstreamDraft): string {
  const unpriced = draft.roles.filter((role) => role.cost === null).map((role) => role.label);
  const reasons = [
    unpriced.length > 0 ? `no day rate is configured for ${joinList(unpriced)}` : '',
    draft.blockedDrivers.length > 0 ? `no base effort is configured for ${joinList(draft.blockedDrivers.map((driver) => driver.id))}` : '',
    draft.unmixedTypes.length > 0 ? 'no role mix is configured for part of its effort' : '',
  ].filter((reason) => reason !== '');
  return `Cost blocked: ${joinList(reasons)}. Effort is shown without a cost and no value is assumed.`;
}

function roleLine(role: RoleAllocation, currency: string): string {
  const head = `Roles: ${role.label} ${formatTenths(role.days)} d`;
  if (role.dayRate === null || role.cost === null) {
    return `${head} x no configured day rate = cost blocked`;
  }
  return `${head} x ${formatWhole(role.dayRate)} = ${formatMoney(role.cost, currency)}`;
}

function isPriced(draft: WorkstreamDraft): boolean {
  const fullySized = draft.blockedDrivers.length === 0 && draft.unmixedTypes.length === 0;
  return fullySized && draft.roles.every((role) => role.cost !== null);
}

function workstreamCost(draft: WorkstreamDraft, spread: ConfidenceSpread, currency: string): MoneyRange | null {
  if (!isPriced(draft)) {
    return null;
  }
  const likely = sum(draft.roles.map((role) => role.cost ?? 0));
  return { ...spreadRange(likely, spread, roundWhole), currency };
}

function costLine(cost: MoneyRange | null, spread: ConfidenceSpread, draft: WorkstreamDraft): string {
  if (cost === null) {
    return blockedBasis(draft);
  }
  return `Cost = sum of role costs = ${formatMoney(cost.likely, cost.currency)}; range ${spreadLabel(spread)} = ${formatMoney(cost.low, cost.currency)} to ${formatMoney(cost.high, cost.currency)}`;
}

/** Second pass over a draft: applies the confidence spread to effort and cost and completes the trace. */
export function finaliseWorkstream(
  draft: WorkstreamDraft,
  assessment: ConfidenceAssessment,
  config: EstimationConfig,
  lookups: ConfigLookups,
): WorkstreamEstimate {
  const spread = lookups.spread(assessment.confidence);
  const effortDays = spreadRange(draft.likelyDays, spread, roundWhole);
  const cost = workstreamCost(draft, spread, config.currency);
  const rangeLine = `Range (${assessment.confidence} confidence ${spreadLabel(spread)}) = ${formatWhole(effortDays.low)} to ${formatWhole(effortDays.high)} days`;
  return {
    id: draft.id,
    name: draft.name,
    phaseId: draft.phaseId,
    requirementIds: draft.requirementIds,
    skills: draft.skills,
    drivers: draft.drivers,
    complexity: draft.complexity,
    baseDays: draft.baseDays,
    adjustments: draft.adjustments,
    effortDays,
    roles: draft.roles,
    cost,
    commercialBasis: cost === null ? blockedBasis(draft) : commercialBasis(config),
    confidence: assessment.confidence,
    confidenceLimitations: assessment.limitations,
    calculation: [
      ...draft.trace,
      rangeLine,
      ...draft.roles.map((role) => roleLine(role, config.currency)),
      costLine(cost, spread, draft),
    ],
  };
}

function mapRange(range: NumericRange, transform: (value: number) => number): NumericRange {
  return { low: transform(range.low), likely: transform(range.likely), high: transform(range.high) };
}

function addRanges(a: NumericRange, b: NumericRange): NumericRange {
  return sumRanges([a, b]);
}

interface RomCommercials {
  subtotal: MoneyRange | null;
  contingency: MoneyRange | null;
  rom: MoneyRange | null;
}

/**
 * CR_11: subtotal = sum of workstream costs rounded to the rounding unit; contingency = subtotal x
 * contingencyPct / 100 rounded to the unit; ROM = subtotal + contingency. The ROM is blocked (null)
 * when any workstream cost is blocked or any calculation input is missing - never understated.
 */
export function romCommercials(
  workstreams: readonly WorkstreamEstimate[],
  config: EstimationConfig,
  calculationBlocked: boolean,
): RomCommercials {
  const costs = workstreams.map((workstream) => workstream.cost);
  if (calculationBlocked || costs.includes(null)) {
    return { subtotal: null, contingency: null, rom: null };
  }
  const { currency, roundingUnit, contingencyPct } = config;
  const raw = sumRanges(costs.filter((cost): cost is MoneyRange => cost !== null));
  const subtotal = mapRange(raw, (value) => roundToUnit(value, roundingUnit));
  const contingency = mapRange(subtotal, (value) => roundToUnit(pctOf(value, contingencyPct), roundingUnit));
  return {
    subtotal: { ...subtotal, currency },
    contingency: { ...contingency, currency },
    rom: { ...addRanges(subtotal, contingency), currency },
  };
}

export function estimateTotals(
  workstreams: readonly WorkstreamEstimate[],
  timelineWeeks: NumericRange,
  config: EstimationConfig,
  calculationBlocked: boolean,
): EstimateTotals {
  const effortDays = sumRanges(workstreams.map((workstream) => workstream.effortDays));
  const daysPerWeek = config.workingDaysPerWeek;
  const toPersonWeeks = (days: number): number => (daysPerWeek > 0 ? roundTenths(days / daysPerWeek) : 0);
  return {
    effortDays,
    effortPersonWeeks: mapRange(effortDays, toPersonWeeks),
    timelineWeeks,
    ...romCommercials(workstreams, config, calculationBlocked),
  };
}

/** Days and cost per role across all workstreams, in rate-table order. */
export function summariseRoles(workstreams: readonly WorkstreamEstimate[], lookups: ConfigLookups): RoleAllocation[] {
  const allocations = workstreams.flatMap((workstream) => workstream.roles);
  const roleIds = [...new Set(allocations.map((role) => role.roleId))];
  const ordered = [
    ...lookups.roleOrder.filter((roleId) => roleIds.includes(roleId)),
    ...roleIds.filter((roleId) => !lookups.roleOrder.includes(roleId)),
  ];
  return ordered.map((roleId) => {
    const own = allocations.filter((role) => role.roleId === roleId);
    const rate = lookups.rate(roleId);
    const blocked = own.some((role) => role.cost === null);
    return {
      roleId,
      label: rate.label,
      days: roundTenths(sum(own.map((role) => role.days))),
      dayRate: rate.dayRate,
      cost: blocked ? null : sum(own.map((role) => role.cost ?? 0)),
    };
  });
}
