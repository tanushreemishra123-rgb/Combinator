/** Small helpers shared by the data-integration and AI-solution planners. */
import { formatId } from '../domain/ids';
import type { ContentLabel, EstimationInputKey, Provenance, ScopeItem, ScopeModel } from '../domain';

export { joinList } from '../domain';

const PROVENANCE_TO_LABEL: ReadonlyMap<Provenance, ContentLabel> = new Map([
  ['customer-stated', 'customer-requested'],
  ['ai-inferred', 'ai-interpretation'],
  ['assumed', 'assumption-to-confirm'],
]);

/** Same grounding-to-label mapping used across every generated deliverable (see spec's content labels). */
export function labelForProvenance(provenance: Provenance): ContentLabel {
  return PROVENANCE_TO_LABEL.get(provenance) ?? 'ai-interpretation';
}

export function findScopeItem(scope: ScopeModel, id: string): ScopeItem | undefined {
  return scope.items.find((item) => item.id === id);
}

/** True when two items share a signal from the given group prefix, e.g. both carry an 'integration:*' id. */
export function shareSignalInGroup(a: ScopeItem, b: ScopeItem, groupPrefix: string): boolean {
  return a.signals.some((signal) => signal.startsWith(groupPrefix) && b.signals.includes(signal));
}

/**
 * True when an open gap or question that leaves `inputKey` unresolved relates to `item` - either by
 * `item` pointing at it, or it pointing back at `item`. Used to set readiness/confidence honestly
 * instead of asserting information the reviewed scope has not actually confirmed.
 */
export function hasUnresolvedInput(scope: ScopeModel, item: ScopeItem, inputKey: EstimationInputKey): boolean {
  return scope.items.some((candidate) => {
    if (candidate.kind !== 'gap' && candidate.kind !== 'question') {
      return false;
    }
    if (candidate.resolved || !candidate.affectsInputs.includes(inputKey)) {
      return false;
    }
    return candidate.relatedIds.includes(item.id) || item.relatedIds.includes(candidate.id);
  });
}

/** Sequential structured ids for this planner's own element kinds (DD_01, IF_01, AIUC_01, ...). */

export function idSequence(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return formatId(prefix, counter);
  };
}

export function uniqueIds(...groups: readonly (readonly string[])[]): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}
