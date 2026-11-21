/**
 * Functional capabilities the customer implies but never states as a requirement of their own:
 * "payments through Stripe" implies a payments capability even when no sentence asks for one.
 * Each implied capability becomes an 'ai-inferred' functional item that cites the triggering line
 * and the requirements it was derived from, so downstream scope is never silently widened.
 */
import { SIGNAL_DEFINITIONS } from '../domain';
import type { ScopeItemKind } from '../domain';
import { sourceFromStatement } from './draftBook';
import type { DraftBook, ExtractedItem } from './draftBook';
import { MAX_RELATED_IDS } from './inference';

export const MAX_IMPLIED_CAPABILITIES = 5;

/** Integration and data statements describe plumbing; the user-facing capability behind them is implied. */
const IMPLYING_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(['integration', 'data']);
/** Too generic to be a requirement of its own: nearly every statement mentions "the portal". */
const GENERIC_CAPABILITIES: ReadonlySet<string> = new Set(['capability:portal']);

const CAPABILITY_SIGNALS = SIGNAL_DEFINITIONS.filter((signal) => signal.group === 'capability' && !GENERIC_CAPABILITIES.has(signal.id));

function statedCapabilities(extracted: readonly ExtractedItem[]): ReadonlySet<string> {
  return new Set(extracted.filter((item) => item.kind === 'functional').flatMap((item) => [...item.signals]));
}

/** One inferred functional requirement per capability that only integration or data statements mention. */
export function inferImpliedCapabilities(extracted: readonly ExtractedItem[], book: DraftBook): void {
  const stated = statedCapabilities(extracted);
  const sources = extracted.filter((item) => IMPLYING_KINDS.has(item.kind));
  const implied = CAPABILITY_SIGNALS.filter((signal) => !stated.has(signal.id))
    .map((signal) => ({ signal, triggers: sources.filter((item) => item.signals.includes(signal.id)).slice(0, MAX_RELATED_IDS) }))
    .filter((entry) => entry.triggers.length > 0)
    .slice(0, MAX_IMPLIED_CAPABILITIES);
  for (const { signal, triggers } of implied) {
    const relatedIds = triggers.map((item) => item.id);
    const first = triggers.at(0);
    const id = book.add('functional', {
      title: signal.label,
      description: `${relatedIds.join(', ')} implies a ${signal.label.toLowerCase()} capability that the customer text does not describe as a requirement of its own. The user journeys, roles and acceptance criteria behind it need to be confirmed before it is baselined.`,
      priority: 'Medium',
      provenance: 'ai-inferred',
      source: first === undefined ? null : sourceFromStatement(first.statement),
    });
    book.linkAll(id, relatedIds);
  }
}
