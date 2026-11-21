/**
 * Range and currency formatting specific to the Estimate Workspace. `formatMoney` and the four
 * building-block numbers already come from the (finished) estimation engine; this only combines
 * them into the low/likely/high strings the transparency requirement asks the reviewer to check.
 */
import type { MoneyRange, NumericRange } from '../../domain';
import { formatMoney } from '../../estimation';
import { formatNumber } from '../common';

export { joinList } from '../../domain';

/** Shown wherever a cost cannot be calculated because a role has no configured day rate. */
export const BLOCKED_COST_LABEL = 'Blocked - missing rates';

/** 'low - high unit (likely X)', collapsing to one value when the range has zero width. */

export function formatNumericRange(range: NumericRange, unit: string): string {
  const low = formatNumber(range.low);
  const high = formatNumber(range.high);
  const core = low === high ? low : `${low} - ${high}`;
  return `${core} ${unit} (likely ${formatNumber(range.likely)})`;
}

/** Same shape as `formatNumericRange` for a priced range, or the blocked label when there is none. */
export function formatMoneyRange(range: MoneyRange | null): string {
  if (range === null) {
    return BLOCKED_COST_LABEL;
  }
  const low = formatMoney(range.low, range.currency);
  const high = formatMoney(range.high, range.currency);
  return low === high ? low : `${low} - ${high} (likely ${formatMoney(range.likely, range.currency)})`;
}

/** Comma-separated list parsed from a free-text field, e.g. target regions: blank entries are dropped. */
export function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Hint shown under a solution-assumption field left empty: the estimator reads this as a missing input. */

export function notProvidedHint(isEmpty: boolean): string | undefined {
  return isEmpty ? 'Not provided - the estimator treats this as a missing input.' : undefined;
}

