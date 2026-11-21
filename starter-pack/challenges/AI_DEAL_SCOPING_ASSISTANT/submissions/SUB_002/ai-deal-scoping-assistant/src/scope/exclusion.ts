/**
 * Customer-declared exclusions. When the customer's own sentence says a request is out of scope
 * ("... though that is out of scope for this initial phase", "... not required for go-live"), the
 * item must not be designed, estimated or reported as covered. The cues are a fixed list matched
 * with plain `includes` on lower-cased text, so no pattern is built from data. "Later phase" on its
 * own is deliberately not a cue: customers use it for staged delivery of work that is still wanted.
 */
import { REQUIREMENT_KINDS } from '../domain';
import type { ScopeItem, ScopeItemDraft, ValidationIssue } from '../domain';

/** Phrases that remove a statement from the current engagement. */
export const EXCLUSION_CUES: readonly string[] = [
  'out of scope',
  'out-of-scope',
  'not in scope',
  'not required for go-live',
  'not required for go live',
  'excluded from scope',
  'excluded from the scope',
  'excluded from this phase',
  'excluded from this engagement',
];

/** The first exclusion cue in `text`, or undefined when the text carries none. */
export function findExclusionCue(text: string): string | undefined {
  const lower = text.toLowerCase();
  return EXCLUSION_CUES.find((cue) => lower.includes(cue));
}

/** The customer sentence behind an item, or '' when it has no source. */
export function sourceQuoteOf(item: Pick<ScopeItemDraft, 'source'>): string {
  return item.source?.quote ?? '';
}

/**
 * True when the item's customer quote or its description says the request is out of scope. Used to
 * start such a requirement excluded, and to list excluded constraints and gaps in the PRD.
 */
export function isCustomerExcluded(item: Pick<ScopeItemDraft, 'source' | 'description'>): boolean {
  return findExclusionCue(sourceQuoteOf(item)) !== undefined || findExclusionCue(item.description) !== undefined;
}

/** Requirement drafts whose own wording excludes them start out of scope; other kinds stay in. */
export function startsInScope(draft: ScopeItemDraft): boolean {
  return !(REQUIREMENT_KINDS.includes(draft.kind) && isCustomerExcluded(draft));
}

/**
 * One info issue per requirement that started excluded, so the reviewer knows why it is off and
 * that turning its "In scope" toggle back on brings it into the deliverables.
 */
export function exclusionIssues(items: readonly ScopeItem[]): ValidationIssue[] {
  return items
    .filter((item) => !item.inScope)
    .map((item) => ({
      severity: 'info',
      code: 'customer-excluded',
      message: `${item.id} starts out of scope because the customer's text says it is excluded from this phase. Switch it back into scope during review if it belongs in this engagement.`,
      refs: [item.id],
    }));
}
