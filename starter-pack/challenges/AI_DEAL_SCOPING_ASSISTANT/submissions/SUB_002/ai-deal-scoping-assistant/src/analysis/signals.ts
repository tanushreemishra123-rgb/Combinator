/**
 * Deterministic signal matcher: maps free text onto the shared taxonomy of src/domain/signals.ts.
 * The PRD, architecture, strategy and estimation planners key off these tags, so the matcher is
 * rule-based and reproducible in both mock and live mode.
 */
import { isKnownSignal, signalLabel } from '../domain';
import { SIGNAL_KEYWORDS } from './signalKeywords.data';
import { containsAnyTerm, normalizeForMatch } from './textMatch';

interface PreparedSignal {
  signalId: string;
  terms: readonly string[];
}

/** Terms are normalised once so authoring slips (hyphens, capitals) cannot break matching. */
const PREPARED_SIGNALS: readonly PreparedSignal[] = SIGNAL_KEYWORDS.filter((entry) => isKnownSignal(entry.signalId)).map(
  (entry) => ({ signalId: entry.signalId, terms: entry.terms.map(normalizeForMatch) }),
);

const AI_SIGNAL_PREFIX = 'ai:';
const PUNCTUATION = /[.,;:!?()"]/g;
const SPACES = /\s+/g;

/**
 * Statements that rule AI out ("AI must not be used for claim decisions"). Such a sentence names
 * AI techniques without asking for them, so it must not create an AI use case or AI effort.
 */
const AI_PROHIBITION_PHRASES: readonly string[] = [
  'no ai', 'no generative ai', 'no machine learning', 'without ai', 'without generative ai',
  'not use ai', 'not use generative ai', 'not use machine learning', 'not use large language models', 'not to use ai',
  'ai must not be used', 'ai may not be used', 'ai cannot be used', 'ai is not permitted', 'ai is not allowed', 'ai is prohibited', 'ai is out of scope',
  'generative ai must not be used', 'generative ai is not permitted', 'machine learning must not be used',
  'prohibits ai', 'prohibit ai', 'prohibits the use of ai', 'prohibit the use of ai',
];

/** Whole-word phrase check: both sides are padded with spaces so 'no ai' never matches 'no aim'. */
function prohibitsAi(normalized: string): boolean {
  const padded = ` ${normalized.replace(PUNCTUATION, ' ').replace(SPACES, ' ').trim()} `;
  return AI_PROHIBITION_PHRASES.some((phrase) => padded.includes(` ${phrase} `));
}

/** Taxonomy tags (e.g. 'integration:crm', 'ai:rag', 'nfr:scalability') found in a piece of text. */
export function detectSignals(text: string): string[] {
  const normalized = normalizeForMatch(text);
  if (normalized === '') {
    return [];
  }
  const found = PREPARED_SIGNALS.filter((signal) => containsAnyTerm(normalized, signal.terms)).map((signal) => signal.signalId);
  return prohibitsAi(normalized) ? found.filter((signalId) => !signalId.startsWith(AI_SIGNAL_PREFIX)) : found;
}

export function hasSignal(signals: readonly string[], signalId: string): boolean {
  return signals.includes(signalId);
}

/**
 * The most frequent signal labels across a set of items ("main themes" of the summary).
 * Ties keep taxonomy order, which makes the result independent of item order.
 */
export function rankSignalThemes(signalSets: readonly (readonly string[])[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const signals of signalSets) {
    for (const signal of signals) {
      counts.set(signal, (counts.get(signal) ?? 0) + 1);
    }
  }
  return PREPARED_SIGNALS.map((signal, order) => ({ id: signal.signalId, order, count: counts.get(signal.signalId) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((entry) => signalLabel(entry.id));
}
