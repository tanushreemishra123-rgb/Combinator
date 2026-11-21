/**
 * Priority from the customer's own modal wording (MoSCoW-style):
 *   must / shall / critical / mandatory / required  -> High
 *   could / nice to have / optional / future        -> Low
 *   should / important                              -> Medium
 * An explicit High cue wins over a Low cue in the same statement ("must ... in a later phase"),
 * except when the customer defers or excludes the item ("... not required for go-live", "... out
 * of scope for this phase"): the "required" there is negated, so the item is Low.
 */
import type { Priority } from '../domain';
import { containsAnyTerm } from './textMatch';

const HIGH_CUES: readonly string[] = [
  'must', 'shall', 'critical', 'mandatory', 'required', 'essential', 'non negotiable', 'top priority', 'high priority', 'key requirement',
  'vital', 'crucial', 'has to', 'have to',
];
const LOW_CUES: readonly string[] = [
  'could', 'nice to have', 'optional', 'future', 'later phase', 'phase 2', 'phase two', 'eventually', 'would like', 'wish', 'low priority',
  'stretch', 'if possible', 'ideally', 'down the line', 'longer term', 'may want',
];

/** Wording that defers or excludes an item; checked first because it contains High words. */
const DEFERRAL_CUES: readonly string[] = [
  'not required for go live', 'not required at go live', 'not required for launch', 'not required at launch', 'not required initially',
  'not required in this phase', 'not required for this phase', 'out of scope', 'not in scope',
];

export const DEFAULT_PRIORITY: Priority = 'Medium';

/** Priority of a statement given its normalised text (see normalizeForMatch). Wording with an
 * explicit medium cue ("should", "important", ...) and wording with no priority cue at all both
 * resolve to the same {@link DEFAULT_PRIORITY}, so no separate medium-cue check is needed. */
export function derivePriority(normalizedText: string): Priority {
  if (containsAnyTerm(normalizedText, DEFERRAL_CUES)) {
    return 'Low';
  }
  if (containsAnyTerm(normalizedText, HIGH_CUES)) {
    return 'High';
  }
  if (containsAnyTerm(normalizedText, LOW_CUES)) {
    return 'Low';
  }
  return DEFAULT_PRIORITY;
}
