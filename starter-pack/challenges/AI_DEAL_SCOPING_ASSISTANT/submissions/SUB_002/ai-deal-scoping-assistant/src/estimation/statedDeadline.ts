/**
 * Finds a delivery deadline the customer stated in the reviewed scope ("target of 46 weeks from
 * contract signature", "go live within nine months") so the Estimate Workspace can offer it as a
 * one-click suggestion. It is deliberately not applied on its own: the deadline stays an input a
 * person confirms, and an empty field keeps being reported as a missing estimation input.
 */
import type { ScopeItem, ScopeItemKind, ScopeModel } from '../domain';
import { getActiveItems } from '../scope';

export interface StatedDeadline {
  weeks: number;
  /** Scope item the duration was read from. */
  sourceId: string;
  /** The duration as the customer wrote it, e.g. "9 months". */
  statedAs: string;
}

/** Average calendar weeks in a month (52 / 12), used to convert a deadline stated in months. */
const WEEKS_PER_MONTH = 52 / 12;
/** Durations above this are programme horizons or retention periods, not a delivery deadline. */
const MAX_DEADLINE_WEEKS = 260;

/** Kinds that carry delivery commitments, in the order they are searched. */
const DEADLINE_KINDS: readonly ScopeItemKind[] = ['constraint', 'dependency', 'business'];

const DELIVERY_CUES: readonly string[] = ['go live', 'go-live', 'golive', 'launch', 'deadline', 'deliver', 'rollout', 'roll-out', 'roll out', 'timeline', 'in production', 'cut over', 'cutover'];
/** Phrases that describe a period after delivery (support, retention), which must not be read as the deadline. */
const POST_DELIVERY_CUES: readonly string[] = ['after go-live', 'after go live', 'post go-live', 'post-launch', 'after launch', 'hypercare', 'warranty', 'retention', 'retained'];

const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['eighteen', 18],
]);

const TENS_WORDS: ReadonlyMap<string, number> = new Map([
  ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50],
]);

interface DurationUnit {
  weeksPerUnit: number;
  singular: string;
  plural: string;
}

const WEEK_UNIT: DurationUnit = { weeksPerUnit: 1, singular: 'week', plural: 'weeks' };
const MONTH_UNIT: DurationUnit = { weeksPerUnit: WEEKS_PER_MONTH, singular: 'month', plural: 'months' };

const UNITS: ReadonlyMap<string, DurationUnit> = new Map([
  ['week', WEEK_UNIT], ['weeks', WEEK_UNIT], ['month', MONTH_UNIT], ['months', MONTH_UNIT],
]);

interface StatedCount {
  count: number;
  words: string;
}

function parseDigits(word: string): number | null {
  const parsed = Number(word);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** The count written just before a unit: digits ("46"), a number word ("nine") or a tens compound ("twenty four"). */
function countBefore(words: readonly string[], unitIndex: number): StatedCount | null {
  const word = words.at(unitIndex - 1);
  if (unitIndex === 0 || word === undefined) {
    return null;
  }
  const tensAlone = TENS_WORDS.get(word);
  if (tensAlone !== undefined) {
    return { count: tensAlone, words: word };
  }
  const count = NUMBER_WORDS.get(word) ?? parseDigits(word);
  if (count === null) {
    return null;
  }
  const tensWord = unitIndex > 1 ? words.at(unitIndex - 2) : undefined;
  const tens = tensWord === undefined ? undefined : TENS_WORDS.get(tensWord);
  if (tens !== undefined && tensWord !== undefined && count < 10 && NUMBER_WORDS.has(word)) {
    return { count: tens + count, words: `${tensWord} ${word}` };
  }
  return { count, words: word };
}

/** First "<count> week(s)/month(s)" pair in the text, read word by word so no backtracking pattern is needed. */
function firstDuration(text: string): { weeks: number; statedAs: string } | null {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const [index, word] of words.entries()) {
    const unit = UNITS.get(word);
    const stated = unit === undefined ? null : countBefore(words, index);
    if (unit === undefined || stated === null) {
      continue;
    }
    const weeks = Math.round(stated.count * unit.weeksPerUnit);
    if (weeks > 0 && weeks <= MAX_DEADLINE_WEEKS) {
      return { weeks, statedAs: `${stated.words} ${stated.count === 1 ? unit.singular : unit.plural}` };
    }
  }
  return null;
}

function mentionsAny(text: string, cues: readonly string[]): boolean {
  return cues.some((cue) => text.includes(cue));
}

function deadlineIn(item: ScopeItem): StatedDeadline | null {
  const text = `${item.title}. ${item.description}`.toLowerCase();
  if (!mentionsAny(text, DELIVERY_CUES) || mentionsAny(text, POST_DELIVERY_CUES)) {
    return null;
  }
  const duration = firstDuration(text);
  return duration === null ? null : { weeks: duration.weeks, sourceId: item.id, statedAs: duration.statedAs };
}

/** The first customer-stated delivery deadline in the reviewed scope, or null when none is stated. Rejected items are ignored. */
export function findStatedDeadline(scope: ScopeModel | null): StatedDeadline | null {
  if (scope === null) {
    return null;
  }
  const candidates = getActiveItems(scope).filter((item) => item.provenance === 'customer-stated');
  for (const kind of DEADLINE_KINDS) {
    for (const item of candidates) {
      const found = item.kind === kind ? deadlineIn(item) : null;
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}
