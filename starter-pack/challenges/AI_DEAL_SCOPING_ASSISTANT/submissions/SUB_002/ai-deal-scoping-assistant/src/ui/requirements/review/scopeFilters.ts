/** Pure filtering/search logic for the "Review the extracted scope" table. */
import type { ScopeItem } from '../../../domain';
import { compareScopeItems } from '../../../scope';
import type { ScopeFilterState } from '../types';
import { SCOPE_KIND_GROUPS } from '../types';

function kindsInGroup(group: ScopeFilterState['kindGroup']): readonly ScopeItem['kind'][] {
  return SCOPE_KIND_GROUPS.find((candidate) => candidate.id === group)?.kinds ?? [];
}

function matchesSearch(item: ScopeItem, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (term.length === 0) {
    return true;
  }
  return [item.id, item.title, item.description].some((value) => value.toLowerCase().includes(term));
}

/** Applies every active filter, then sorts by the spec's kind order and structured id. */
export function filterScopeItems(items: readonly ScopeItem[], filters: ScopeFilterState): ScopeItem[] {
  const allowedKinds = kindsInGroup(filters.kindGroup);
  return items
    .filter((item) => allowedKinds.includes(item.kind))
    .filter((item) => filters.provenance === 'all' || item.provenance === filters.provenance)
    .filter((item) => filters.priority === 'all' || item.priority === filters.priority)
    .filter((item) => filters.review === 'all' || item.review === filters.review)
    .filter((item) => matchesSearch(item, filters.search))
    .sort(compareScopeItems);
}
