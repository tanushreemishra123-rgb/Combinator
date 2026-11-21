import { stableFingerprint } from '../../impact';
import type { EstimateBundle, EstimateResult, MoneyRange, NumericRange } from '../../domain';
import { findDoubleCountedDrivers } from '../../estimation';
import { fail, formatAmount, notGenerated, warn } from '../checkKit';
import type { GradedFinding, QualityCheckSpec, QualityContext } from '../types';

/** Person-day totals are sums of tenths; anything beyond half a day is a real discrepancy. */
const EFFORT_TOLERANCE_DAYS = 0.5;
/** Tolerance for sums that must match exactly apart from floating-point noise. */
const MONEY_EPSILON = 0.5;

function sumRanges(ranges: readonly NumericRange[]): NumericRange {
  return ranges.reduce<NumericRange>((total, range) => ({ low: total.low + range.low, likely: total.likely + range.likely, high: total.high + range.high }), { low: 0, likely: 0, high: 0 });
}

function rangesDiffer(a: NumericRange, b: NumericRange, tolerance: number): boolean {
  return Math.abs(a.low - b.low) > tolerance || Math.abs(a.likely - b.likely) > tolerance || Math.abs(a.high - b.high) > tolerance;
}

function scaleRange(range: NumericRange, factor: number): NumericRange {
  return { low: range.low * factor, likely: range.likely * factor, high: range.high * factor };
}

function effortFindings(result: EstimateResult): GradedFinding[] {
  const summed = sumRanges(result.workstreams.map((workstream) => workstream.effortDays));
  return rangesDiffer(summed, result.totals.effortDays, EFFORT_TOLERANCE_DAYS)
    ? [fail(`Total effort (${formatAmount(result.totals.effortDays.likely)} likely person-days) does not equal the sum of the workstreams (${formatAmount(summed.likely)} likely person-days).`)]
    : [];
}

/** subtotal = sum of workstream costs (rounded); contingency = subtotal x pct (rounded); ROM = subtotal + contingency. */
function commercialFindings(result: EstimateResult): GradedFinding[] {
  const { subtotal, contingency, rom } = result.totals;
  if (subtotal === null || contingency === null || rom === null) {
    return [];
  }
  const { roundingUnit, contingencyPct } = result.configSnapshot;
  const roundingTolerance = roundingUnit / 2 + MONEY_EPSILON;
  const costs = result.workstreams.map((workstream) => workstream.cost).filter((cost): cost is MoneyRange => cost !== null);
  const findings: GradedFinding[] = [];
  if (costs.length !== result.workstreams.length) {
    findings.push(fail('A ROM is presented although at least one workstream has no cost because a role rate is missing.'));
  } else if (rangesDiffer(sumRanges(costs), subtotal, roundingTolerance)) {
    findings.push(fail(`The commercial subtotal (${formatAmount(subtotal.likely)} ${subtotal.currency}) does not equal the sum of the workstream costs within the rounding unit of ${formatAmount(roundingUnit)}.`));
  }
  if (rangesDiffer(scaleRange(subtotal, contingencyPct / 100), contingency, roundingTolerance)) {
    findings.push(fail(`Contingency (${formatAmount(contingency.likely)} ${contingency.currency}) is not ${formatAmount(contingencyPct)}% of the subtotal within the rounding unit.`));
  }
  if (rangesDiffer(sumRanges([subtotal, contingency]), rom, MONEY_EPSILON)) {
    findings.push(fail(`The ROM (${formatAmount(rom.likely)} ${rom.currency}) does not equal subtotal plus contingency (${formatAmount(subtotal.likely + contingency.likely)}).`));
  }
  return findings;
}

function currencyFindings(result: EstimateResult, configuredCurrency: string): GradedFinding[] {
  const { subtotal, contingency, rom } = result.totals;
  const used = [subtotal, contingency, rom, ...result.workstreams.map((workstream) => workstream.cost)]
    .filter((money): money is MoneyRange => money !== null)
    .map((money) => money.currency);
  const mismatched = [...new Set(used)].filter((currency) => currency !== configuredCurrency);
  return mismatched.map((currency) => fail(`Commercial figures are expressed in ${currency}, but the commercial configuration is set to ${configuredCurrency}.`));
}

/** A reviewer's complexity setting must be the one the engine actually used. */
function overrideFindings(bundle: EstimateBundle): GradedFinding[] {
  const drivers = bundle.result.workstreams.flatMap((workstream) => workstream.drivers);
  return bundle.overrides
    .filter((override) => drivers.find((driver) => driver.id === override.driverId)?.complexity !== override.complexity)
    .map((override) => fail(`The reviewer set estimate driver ${override.driverId} to ${override.complexity} complexity, but the calculated estimate does not use that setting.`, [override.driverId]));
}

/**
 * The same reviewed requirements must not be priced by two drivers in different workstreams. A
 * reviewer may still accept a deliberate overlap, so this is a warning rather than a failure.
 */
function doubleCountingFindings(bundle: EstimateBundle): GradedFinding[] {
  return findDoubleCountedDrivers(bundle.suggestion).map((pair) =>
    warn(
      `Estimate drivers ${pair.driverA} (${pair.workstreamA}) and ${pair.driverB} (${pair.workstreamB}) both price ${pair.refIds.join(', ')}, so that scope is counted twice; remove or narrow one of them.`,
      [pair.driverA, pair.driverB, ...pair.refIds],
    ),
  );
}

function run(context: QualityContext): GradedFinding[] {
  const bundle = context.session.outputs.estimate.data;
  if (bundle === null) {
    return [notGenerated('the effort, timeline and ROM estimate does not exist, so its consistency cannot be checked.')];
  }
  const current = context.session.estimationConfig;
  const outOfDate =
    stableFingerprint(bundle.result.configSnapshot) === stableFingerprint(current)
      ? []
      : [fail('The estimate is out of date: the rate card or estimation configuration was edited after the numbers were calculated. Recalculate the estimate.')];
  return [
    ...outOfDate,
    ...effortFindings(bundle.result),
    ...commercialFindings(bundle.result),
    ...currencyFindings(bundle.result, current.currency),
    ...overrideFindings(bundle),
    ...doubleCountingFindings(bundle),
  ];
}

export const estimateConsistencyCheck: QualityCheckSpec = {
  id: 'estimate-consistency',
  label: 'Estimate or commercial inconsistencies',
  description: 'Totals equal the sum of the workstreams, ROM equals subtotal plus contingency, the currency matches the configuration, the numbers were computed from the current configuration and no reviewed requirement is priced by two drivers.',
  run,
};
