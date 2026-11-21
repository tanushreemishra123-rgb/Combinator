/**
 * Rules CR_02 to CR_04: a build workstream's base effort is the sum of its driver days; the
 * environment uplift applies to infrastructure drivers only; the productivity factor applies last.
 */
import type { DriverType, EffortAdjustment, EstimateDriver, WorkstreamSuggestion } from '../../domain';
import { countOf, formatDecimal, formatFactor, formatPct, formatWhole } from '../format';
import { distinct } from '../scopeFacts';
import { describeDriver, resolveDriver, weightedComplexity } from './drivers';
import type { EngineContext, WorkstreamDraft } from './model';
import { pctOf, roundWhole, stabilise, sum } from './numbers';
import { allocateRoles } from './roles';

const UPLIFTED_TYPE: DriverType = 'infrastructure';

interface EffortStep {
  adjustment: EffortAdjustment | null;
  line: string | null;
}

function daysOfType(drivers: readonly EstimateDriver[], type: DriverType): number {
  return sum(drivers.filter((driver) => driver.type === type).map((driver) => driver.unitDays));
}

function baseEffortLine(drivers: readonly EstimateDriver[], baseDays: number): string {
  const terms = drivers.map((driver) => formatWhole(driver.unitDays));
  const breakdown = terms.length > 1 ? `${terms.join(' + ')} = ` : '';
  return `Base effort = ${breakdown}${formatWhole(baseDays)} days`;
}

/** CR_03: factor = 1 + max(0, environments - baseline) x extraEnvironmentPct / 100, infrastructure only. */
function environmentUplift(context: EngineContext, infrastructureDays: number): EffortStep {
  const { environments } = context.solution;
  if (infrastructureDays <= 0) {
    return { adjustment: null, line: null };
  }
  if (environments === null) {
    const line = 'Environment uplift not applied: the number of environments has not been provided (see missing inputs)';
    return { adjustment: null, line };
  }
  const { baselineEnvironments, extraEnvironmentPct } = context.estimationConfig;
  const extra = Math.max(0, environments - baselineEnvironments);
  const factor = stabilise(1 + pctOf(extra, extraEnvironmentPct));
  const basis = `${countOf(extra, 'environment')} above the baseline of ${formatWhole(baselineEnvironments)} x ${formatPct(extraEnvironmentPct)}`;
  return {
    adjustment: {
      label: 'Extra environments (infrastructure drivers only)',
      factor,
      reason: `${formatWhole(environments)} environments are configured: ${basis}.`,
    },
    line: `Environment uplift: ${formatWhole(infrastructureDays)} infrastructure days x ${formatFactor(factor)} (${basis}) = ${formatDecimal(infrastructureDays * factor)} days`,
  };
}

/** CR_04: an unusable factor is never guessed - it is reported and no adjustment is made. */
function productivityStep(factor: number): EffortAdjustment {
  if (!Number.isFinite(factor) || factor <= 0) {
    return {
      label: 'Productivity factor',
      factor: 1,
      reason: 'The configured productivity factor is not a positive number, so no productivity adjustment is applied.',
    };
  }
  const reason =
    factor === 1
      ? 'Baseline productivity: no adjustment.'
      : `Configured productivity assumption: effort is multiplied by ${formatFactor(factor)} (below 1 is faster than baseline).`;
  return { label: 'Productivity factor', factor, reason };
}

function distinctTypes(drivers: readonly EstimateDriver[]): DriverType[] {
  return distinct(drivers.map((driver) => driver.type));
}

/** Builds one scope-driven workstream up to its likely effort and role split. */
export function buildWorkstreamDraft(suggestion: WorkstreamSuggestion, context: EngineContext): WorkstreamDraft {
  const resolved = suggestion.drivers.map((driver) => resolveDriver(driver, context));
  const drivers = resolved.map((entry) => entry.driver);
  const baseDays = sum(drivers.map((driver) => driver.unitDays));
  const infrastructureDays = daysOfType(drivers, UPLIFTED_TYPE);
  const uplift = environmentUplift(context, infrastructureDays);
  const upliftFactor = uplift.adjustment?.factor ?? 1;
  const productivity = productivityStep(context.estimationConfig.productivityFactor);
  const upliftedDays = baseDays - infrastructureDays + infrastructureDays * upliftFactor;
  const likelyDays = roundWhole(upliftedDays * productivity.factor);
  const demands = distinctTypes(drivers).map((type) => ({
    key: type,
    days: daysOfType(drivers, type) * (type === UPLIFTED_TYPE ? upliftFactor : 1),
  }));
  const allocation = allocateRoles(likelyDays, demands, context.lookups);
  const startLabel = uplift.adjustment === null ? 'Base' : 'Adjusted';
  const likelyLine = `${startLabel} ${formatDecimal(upliftedDays)} days x productivity ${formatFactor(productivity.factor)} = ${formatWhole(likelyDays)} days (likely effort, rounded to whole days)`;
  return {
    id: suggestion.id,
    name: suggestion.name,
    phaseId: suggestion.phaseId,
    kind: 'build',
    requirementIds: [...suggestion.requirementIds],
    skills: [...suggestion.skills],
    drivers,
    blockedDrivers: resolved.filter((entry) => entry.blocked).map((entry) => entry.driver),
    complexity: weightedComplexity(drivers.map((driver) => ({ complexity: driver.complexity, weight: driver.unitDays }))),
    baseDays,
    adjustments: [...(uplift.adjustment === null ? [] : [uplift.adjustment]), productivity],
    likelyDays,
    roles: allocation.roles,
    unmixedTypes: allocation.unmixedTypes,
    trace: [
      ...resolved.map(describeDriver),
      baseEffortLine(drivers, baseDays),
      ...(uplift.line === null ? [] : [uplift.line]),
      likelyLine,
    ],
  };
}
