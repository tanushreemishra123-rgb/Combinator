/**
 * Read-only selectors over the reviewed scope model. They are local to the estimation module so the
 * pure engine has no runtime dependency on other feature modules.
 */
import type { ScopeItem, ScopeItemKind, ScopeModel } from '../domain';

const OPEN_ITEM_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(['gap', 'question']);

/** Items the estimate may rely on: in scope and not rejected during review. */
export function activeItems(scope: ScopeModel): ScopeItem[] {
  return scope.items.filter((item) => item.inScope && item.review !== 'rejected');
}

export function itemsOfKind(items: readonly ScopeItem[], kind: ScopeItemKind): ScopeItem[] {
  return items.filter((item) => item.kind === kind);
}

export function indexItems(items: readonly ScopeItem[]): ReadonlyMap<string, ScopeItem> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Gaps and questions that are still unresolved in the reviewed scope. */
export function openItems(scope: ScopeModel): ScopeItem[] {
  return activeItems(scope).filter((item) => OPEN_ITEM_KINDS.has(item.kind) && !item.resolved);
}

/** The candidates linked, in either direction, to any of the given scope ids. */
function linkedCandidates(scope: ScopeModel, refIds: readonly string[], candidates: readonly ScopeItem[]): ScopeItem[] {
  const refs = new Set(refIds);
  const linkedFromRefs = new Set(
    activeItems(scope)
      .filter((item) => refs.has(item.id))
      .flatMap((item) => item.relatedIds),
  );
  return candidates.filter(
    (candidate) => linkedFromRefs.has(candidate.id) || candidate.relatedIds.some((id) => refs.has(id)),
  );
}

/** Open gaps/questions linked, in either direction, to any of the given scope ids. */
export function relatedOpenItems(scope: ScopeModel, refIds: readonly string[]): ScopeItem[] {
  return linkedCandidates(scope, refIds, openItems(scope));
}

/**
 * Delivery dependencies not yet met that are linked, in either direction, to any of the given
 * scope ids. Kept apart from openItems so gaps and questions keep their own meaning: a dependency
 * adds no effort, it only makes the dependent work less certain.
 */
export function relatedOutstandingDependencies(scope: ScopeModel, refIds: readonly string[]): ScopeItem[] {
  const outstanding = itemsOfKind(activeItems(scope), 'dependency').filter((item) => !item.resolved);
  return linkedCandidates(scope, refIds, outstanding);
}

export function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

const TRAILING_PUNCTUATION = /[.?!]+$/;

/**
 * 'GAP_01 "CRM API readiness unknown"' - IDs are always shown with their title (without its end
 * punctuation). The title is quoted so a list of citations inside a sentence stays readable and
 * matches how the quality checks name items.
 */
export function citeItem(item: ScopeItem): string {
  return `${item.id} "${item.title.trim().replace(TRAILING_PUNCTUATION, '')}"`;
}

/**
 * 'CRM API readiness unknown (GAP_01)' - the sentence-friendly counterpart of citeItem for text
 * meant to read as prose: the title carries the sentence, the id is a parenthetical reference
 * instead of the sentence's bare subject.
 */
export function describeItem(item: ScopeItem): string {
  return `${item.title.trim().replace(TRAILING_PUNCTUATION, '')} (${item.id})`;
}
