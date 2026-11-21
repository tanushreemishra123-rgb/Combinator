/** Read-only views over a `ScopeModel`. None of these mutate or copy the model itself. */
import { REQUIREMENT_KINDS } from '../domain';
import type { ScopeItem, ScopeItemKind, ScopeModel } from '../domain';

/** Items that are not rejected - the set every other selector (except `getExcludedRequirements`) starts from. */
export function getActiveItems(scope: ScopeModel): ScopeItem[] {
  return scope.items.filter((item) => item.review !== 'rejected');
}

/** Requirement-kind items that are in scope and not rejected - what downstream stages must cover. */
export function getRequirements(scope: ScopeModel): ScopeItem[] {
  return getActiveItems(scope).filter((item) => REQUIREMENT_KINDS.includes(item.kind) && item.inScope);
}

/**
 * Every non-rejected item of one kind, including ones the reviewer excluded from scope. Change
 * impact and quality checks need the excluded items too; generated deliverables must use
 * {@link getInScopeItemsByKind} instead so an excluded item is never presented as requested scope.
 */
export function getItemsByKind(scope: ScopeModel, kind: ScopeItemKind): ScopeItem[] {
  return getActiveItems(scope).filter((item) => item.kind === kind);
}

/**
 * Non-rejected, in-scope items of one kind: what the PRD and the exported package may present as
 * scope. An excluded item appears only under "out of scope", never alongside requested scope.
 */
export function getInScopeItemsByKind(scope: ScopeModel, kind: ScopeItemKind): ScopeItem[] {
  return getItemsByKind(scope, kind).filter((item) => item.inScope);
}

/**
 * Requirement-kind items that will not appear in downstream deliverables: either explicitly
 * excluded (`inScope === false`, still under review or approved) or rejected outright. These are
 * the items the exported package lists under "out of scope".
 */
export function getExcludedRequirements(scope: ScopeModel): ScopeItem[] {
  return scope.items.filter((item) => REQUIREMENT_KINDS.includes(item.kind) && (item.review === 'rejected' || !item.inScope));
}

function activeUnresolvedOfKind(scope: ScopeModel, kind: ScopeItemKind): ScopeItem[] {
  return getActiveItems(scope).filter((item) => item.kind === kind && !item.resolved);
}

export function getOpenQuestions(scope: ScopeModel): ScopeItem[] {
  return activeUnresolvedOfKind(scope, 'question');
}

export function getUnvalidatedAssumptions(scope: ScopeModel): ScopeItem[] {
  return activeUnresolvedOfKind(scope, 'assumption');
}

export function getOpenGaps(scope: ScopeModel): ScopeItem[] {
  return activeUnresolvedOfKind(scope, 'gap');
}

export function findItem(scope: ScopeModel, id: string): ScopeItem | undefined {
  return scope.items.find((item) => item.id === id);
}

/**
 * IDs that generated content may legitimately cite: active, in-scope items of any kind (not just
 * requirement kinds), since a generated element may just as well reference an assumption,
 * dependency or risk it relies on. Used by the traceability module to flag unsupported references.
 */
export function knownIds(scope: ScopeModel): Set<string> {
  return new Set(getActiveItems(scope).filter((item) => item.inScope).map((item) => item.id));
}
