/**
 * Small Intl-based formatting helpers shared by every workspace, so number, date and plural
 * formatting stay consistent without each component reaching for `Intl` directly.
 */

const DEFAULT_LOCALE = 'en-US';

/** Formats a plain number with thousands separators, e.g. 12000 -> '12,000'. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value);
}

/**
 * Formats a low/high pair as a range, e.g. formatRange(120, 180, 'days') -> '120 - 180 days'.
 * Collapses to a single value when low and high format the same (e.g. a zero-width range).
 */
export function formatRange(low: number, high: number, unit?: string): string {
  const formattedLow = formatNumber(low);
  const formattedHigh = formatNumber(high);
  const core = formattedLow === formattedHigh ? formattedLow : `${formattedLow} - ${formattedHigh}`;
  return unit === undefined || unit.length === 0 ? core : `${core} ${unit}`;
}

/** Formats an ISO timestamp for display, e.g. 'Sep 19, 2026, 10:32 AM'. Falls back for bad input. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** Picks the correct plural form for a count using Intl.PluralRules, e.g. '1 item' / '2 items'. */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  const rules = new Intl.PluralRules(DEFAULT_LOCALE);
  const word = rules.select(count) === 'one' ? singular : plural;
  return `${formatNumber(count)} ${word}`;
}
