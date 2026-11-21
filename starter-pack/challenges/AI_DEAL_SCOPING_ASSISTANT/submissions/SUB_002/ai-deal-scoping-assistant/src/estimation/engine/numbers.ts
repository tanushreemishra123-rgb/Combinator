/** Rounding and range arithmetic used by every calculation rule. */
import type { ConfidenceSpread, NumericRange } from '../../domain';

const STABLE_DECIMALS = 6;
const TENTHS_PER_DAY = 10;

/** Removes binary floating-point noise (e.g. 11.499999999999998) before a value is rounded. */
export function stabilise(value: number): number {
  return Number(value.toFixed(STABLE_DECIMALS));
}

export function roundWhole(value: number): number {
  return Math.round(stabilise(value));
}

export function ceilWhole(value: number): number {
  return Math.ceil(stabilise(value));
}

export function roundTenths(value: number): number {
  return Math.round(stabilise(value * TENTHS_PER_DAY)) / TENTHS_PER_DAY;
}

/** Multiplies before dividing so whole-number inputs stay exact (10 x 115 / 100 = 11.5). */
export function pctOf(value: number, pct: number): number {
  return (value * pct) / 100;
}

/** Rounds to the configured unit; a non-positive unit means "no rounding beyond whole currency". */
export function roundToUnit(value: number, unit: number): number {
  const effectiveUnit = Number.isFinite(unit) && unit > 0 ? unit : 1;
  return roundWhole(value / effectiveUnit) * effectiveUnit;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** low = likely x (1 - lowPct/100), high = likely x (1 + highPct/100); never below zero. */
export function spreadRange(
  likely: number,
  spread: Pick<ConfidenceSpread, 'lowPct' | 'highPct'>,
  round: (value: number) => number,
): NumericRange {
  return {
    low: Math.max(0, round(pctOf(likely, 100 - spread.lowPct))),
    likely,
    high: round(pctOf(likely, 100 + spread.highPct)),
  };
}

export function sumRanges(ranges: readonly NumericRange[]): NumericRange {
  return {
    low: sum(ranges.map((range) => range.low)),
    likely: sum(ranges.map((range) => range.likely)),
    high: sum(ranges.map((range) => range.high)),
  };
}
