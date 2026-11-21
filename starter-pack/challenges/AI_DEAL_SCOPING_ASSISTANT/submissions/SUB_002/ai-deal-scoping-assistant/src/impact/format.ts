/** Text helpers shared by change detection, impact reasons and the explanation. */
import { joinList } from '../domain';

export { joinList };

const WHOLE_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Longest id list spelled out in a reason before it is summarised as 'and N more'. */
const MAX_LISTED_IDS = 6;

/** Longest requirement text quoted in a change label. */
const MAX_QUOTE_LENGTH = 140;

/** 500000 -> '500,000'. */
export function formatNumber(value: number): string {
  return WHOLE_NUMBER.format(value);
}

/** Like joinList, but keeps long id lists readable: 'A, B, C, D, E, F and 4 more'. */
export function summariseList(values: readonly string[]): string {
  if (values.length <= MAX_LISTED_IDS) {
    return joinList(values);
  }
  const hidden = values.length - MAX_LISTED_IDS;
  return `${values.slice(0, MAX_LISTED_IDS).join(', ')} and ${formatNumber(hidden)} more`;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Subject-verb agreement for generated sentences: pick('cites', 'cite', ids.length). */
export function pick(singular: string, plural: string, count: number): string {
  return count === 1 ? singular : plural;
}

/** Shortens long requirement text so change labels stay one sentence. */
export function quote(text: string): string {
  const trimmed = text.trim();
  const shortened = trimmed.length > MAX_QUOTE_LENGTH ? `${trimmed.slice(0, MAX_QUOTE_LENGTH - 3).trimEnd()}...` : trimmed;
  return `"${shortened}"`;
}

/** Ends a sentence with exactly one full stop. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

/**
 * Key-order independent fingerprint of plain configuration data. Two configurations with the same
 * values compare equal even when one was re-created by a session import.
 */

export function stableFingerprint(value: unknown): string {
  return JSON.stringify(canonical(value));
}
