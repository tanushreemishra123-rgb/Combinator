/** Text formatting shared by the calculation trace, the planner rationale and the missing-input messages. */

export { joinList } from '../domain';

const LOCALE = 'en-US';
const WHOLE_NUMBER = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const UP_TO_TWO_DECIMALS = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Whole number with thousands separators, e.g. 25,536. */
export function formatWhole(value: number): string {
  return WHOLE_NUMBER.format(Math.round(finiteOrZero(value)));
}

/**
 * Money without fraction digits followed by the configured currency code, e.g. '25,536 USD'.
 * The code is printed as configured (never a locale symbol) so any currency the user types works.
 */
export function formatMoney(value: number, currency: string): string {
  const amount = formatWhole(value);
  const code = currency.trim().toUpperCase();
  return code === '' ? amount : `${amount} ${code}`;
}

/** Role days are tracked in tenths of a day, e.g. 33.6. */
export function formatTenths(value: number): string {
  return ONE_DECIMAL.format(finiteOrZero(value));
}

/** Multipliers are always shown with two decimals, e.g. 1.00 or 0.90. */
export function formatFactor(value: number): string {
  return finiteOrZero(value).toFixed(2);
}

export function formatPct(value: number): string {
  return `${UP_TO_TWO_DECIMALS.format(finiteOrZero(value))}%`;
}

export function formatDecimal(value: number): string {
  return UP_TO_TWO_DECIMALS.format(finiteOrZero(value));
}

/** '1 week' / '3 weeks' - the plural only adds an 's', which covers every unit used here. */

export function countOf(count: number, singular: string): string {
  return `${formatWhole(count)} ${singular}${count === 1 ? '' : 's'}`;
}

