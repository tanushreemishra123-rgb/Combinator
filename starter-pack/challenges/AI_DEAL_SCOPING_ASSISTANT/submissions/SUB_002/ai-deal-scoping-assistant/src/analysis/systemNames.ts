/**
 * Names the systems on the other side of an integration statement: every well-known product it
 * mentions, else the proper noun following "with / to / from / via", else the taxonomy label of
 * the integration signal.
 */
import { signalLabel } from '../domain';
import { EXCHANGE_STYLE_SIGNALS, KNOWN_SYSTEMS } from './inference.data';
import type { Statement } from './segmentation';
import { containsAnyTerm } from './textMatch';

const PREPOSITIONS: ReadonlySet<string> = new Set(['with', 'to', 'from', 'into', 'via', 'through', 'using', 'currently', 'called', 'named']);
const DETERMINERS: ReadonlySet<string> = new Set([
  'our', 'the', 'their', 'existing', 'current', 'a', 'an', 'internal', 'legacy', 'in-house', 'corporate', 'central', 'new',
]);
const STARTS_UPPERCASE = /^\p{Lu}/u;
const TOKEN_EDGE_PUNCTUATION = /^[("'“]+|[)"'”.,;:!?]+$/gu;
/** Product names rarely exceed three words ("Oracle E-Business Suite"). */
const MAX_NAME_WORDS = 3;
/** One statement rarely integrates more systems than this; the cap keeps inferred items reviewable. */
export const MAX_SYSTEMS_PER_STATEMENT = 3;

function knownSystemNames(normalized: string): string[] {
  return KNOWN_SYSTEMS.filter((system) => containsAnyTerm(normalized, system.terms))
    .map((system) => system.name)
    .slice(0, MAX_SYSTEMS_PER_STATEMENT);
}

function capitalisedRun(tokens: readonly string[]): string[] {
  const run: string[] = [];
  for (const token of tokens) {
    if (run.length >= MAX_NAME_WORDS || !STARTS_UPPERCASE.test(token)) {
      break;
    }
    run.push(token);
  }
  return run;
}

/** "integrate with our Acme Billing platform" -> "Acme Billing". */
function properNounAfterPreposition(text: string): string | undefined {
  const tokens = text.split(/\s+/).map((token) => token.replace(TOKEN_EDGE_PUNCTUATION, ''));
  for (const [index, token] of tokens.entries()) {
    if (!PREPOSITIONS.has(token.toLowerCase())) {
      continue;
    }
    const candidates = tokens.slice(index + 1);
    const firstContent = candidates.findIndex((candidate) => !DETERMINERS.has(candidate.toLowerCase()));
    const run = firstContent === -1 ? [] : capitalisedRun(candidates.slice(firstContent));
    if (run.length > 0) {
      return run.join(' ');
    }
  }
  return undefined;
}

function systemSignalLabel(signals: readonly string[]): string | undefined {
  const systemSignal = signals.find((signal) => signal.startsWith('integration:') && !EXCHANGE_STYLE_SIGNALS.includes(signal));
  return systemSignal === undefined ? undefined : `the ${signalLabel(systemSignal)}`;
}

/** Every system the statement integrates with; empty when the text gives no handle at all. */
export function resolveSystemNames(statement: Statement, signals: readonly string[]): string[] {
  const known = knownSystemNames(statement.normalized);
  if (known.length > 0) {
    return known;
  }
  const fallback = properNounAfterPreposition(statement.text) ?? systemSignalLabel(signals);
  return fallback === undefined ? [] : [fallback];
}

/** Best available name for the (first) integrated system, or undefined when none can be named. */
export function resolveSystemName(statement: Statement, signals: readonly string[]): string | undefined {
  return resolveSystemNames(statement, signals).at(0);
}
