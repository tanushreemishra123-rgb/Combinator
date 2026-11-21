/**
 * Pure, immutable scope-model management. Every function here returns a brand-new `ScopeModel`;
 * none of them mutate their inputs. `version` is incremented whenever any item's data changes
 * (see `withItems`) - it is the "edit counter" the rest of the application reproduces generation
 * from (`GenerationMeta.scopeVersion`) and compares against `approvedVersion` to know whether the
 * model needs re-approval.
 */
import { nextIdForKind } from '../domain';
import type { ReviewStatus, ScopeItem, ScopeItemKind, ScopeModel } from '../domain';
import { ScopeApprovalError, ScopeItemNotFoundError } from './errors';
import { exclusionIssues, startsInScope } from './exclusion';
import type { NewScopeItemFields, ScopeDraftInput, ScopeItemPatch } from './types';

/** Kinds `resolveItem`/`reopenItem` apply to; every other kind is left untouched ("ignored"). */
const RESOLVABLE_KINDS: ReadonlySet<ScopeItemKind> = new Set(['question', 'gap', 'assumption']);

/**
 * Replaces the item list and bumps `version`. `approvedAt`/`approvedVersion` are left exactly as
 * they were: if the model was approved at the previous version, `approvedVersion` now differs
 * from the new `version`, so `isScopeApproved` correctly flips to false without either field being
 * cleared - the UI can show "approved on <date>, needs re-approval" instead of losing the history.
 */
function withItems(scope: ScopeModel, items: ScopeItem[]): ScopeModel {
  return { ...scope, items, version: scope.version + 1 };
}

function requireItem(scope: ScopeModel, id: string): ScopeItem {
  const item = scope.items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new ScopeItemNotFoundError(id);
  }
  return item;
}

function withOnlyDefinedFields<T extends object>(patch: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/**
 * Builds the initial reviewable scope model from an analysis draft. Every item starts `pending`
 * review and unresolved regardless of kind, per the review workflow in spec section 1. Items start
 * in scope, except a requirement whose customer wording itself declares it out of scope (see
 * `exclusion.ts`): that one starts excluded, with an info issue telling the reviewer they can
 * include it again. `signals` (taxonomy tags from the analysis stage's `detectSignals`) are
 * preserved when a draft already carries them, and default to `[]` otherwise so downstream
 * generators always see an array.
 */
export function createScopeModel(summary: string, drafts: ScopeDraftInput[]): ScopeModel {
  const items: ScopeItem[] = drafts.map((draft) => ({
    ...draft,
    signals: draft.signals === undefined ? [] : [...draft.signals],
    review: 'pending',
    inScope: startsInScope(draft),
    userEdited: false,
    resolved: false,
    resolution: '',
  }));
  return { summary, items, version: 1, approvedAt: null, approvedVersion: null, issues: exclusionIssues(items) };
}

/**
 * True when an item may be labelled customer-stated: it already is, or it carries a customer
 * source that grounding verified. A manually added item has no source, so calling it
 * customer-stated would claim customer wording that does not exist.
 */
export function canBeCustomerStated(item: ScopeItem): boolean {
  return item.provenance === 'customer-stated' || item.source?.verified === true;
}

/** Drops a request to relabel an item as customer-stated when it has no verified customer source. */
function withGuardedProvenance(item: ScopeItem, patch: ScopeItemPatch): ScopeItemPatch {
  if (patch.provenance !== 'customer-stated' || canBeCustomerStated(item)) {
    return patch;
  }
  const { provenance: _ignored, ...rest } = patch;
  return rest;
}

/**
 * Applies a reviewer's edit to one item. `provenance` is only changed when the patch explicitly
 * sets it - an edit to, say, `title` does not silently reclassify a customer-stated item as
 * assumed - and never to customer-stated for an item without a verified customer source. Always
 * sets `userEdited` so the UI can distinguish reviewer edits from the original extraction.
 */
export function updateScopeItem(scope: ScopeModel, id: string, patch: ScopeItemPatch): ScopeModel {
  const item = requireItem(scope, id);
  const definedPatch = withOnlyDefinedFields(withGuardedProvenance(item, patch));
  const items = scope.items.map((item) => (item.id === id ? { ...item, ...definedPatch, userEdited: true } : item));
  return withItems(scope, items);
}

/**
 * Adds a reviewer-authored item. Its provenance is always `'assumed'` with no source, never
 * `'customer-stated'`: the text did not come from the customer's original submission, so it must
 * be flagged for confirmation like any other assumption, matching the grounding hierarchy in spec
 * section 1 ("customer-stated, AI-inferred, or assumed"). This holds for every kind, including
 * kinds other than `'assumption'` itself (e.g. a manually added functional requirement is still an
 * assumption about scope until a reviewer or the customer confirms it).
 */
export function addScopeItem(scope: ScopeModel, kind: ScopeItemKind, fields: NewScopeItemFields): ScopeModel {
  const id = nextIdForKind(
    kind,
    scope.items.map((item) => item.id),
  );
  const item: ScopeItem = {
    id,
    kind,
    title: fields.title,
    description: fields.description,
    priority: fields.priority,
    provenance: 'assumed',
    source: null,
    relatedIds: fields.relatedIds ?? [],
    affectsInputs: fields.affectsInputs ?? [],
    critical: fields.critical ?? false,
    signals: fields.signals === undefined ? [] : [...fields.signals],
    review: 'pending',
    inScope: true,
    userEdited: true,
    resolved: false,
    resolution: '',
  };
  return withItems(scope, [...scope.items, item]);
}

/** Removes an item and strips its id from every other item's `relatedIds` so no dangling refs remain. */
export function removeScopeItem(scope: ScopeModel, id: string): ScopeModel {
  requireItem(scope, id);
  const items = scope.items
    .filter((item) => item.id !== id)
    .map((item) => (item.relatedIds.includes(id) ? { ...item, relatedIds: item.relatedIds.filter((ref) => ref !== id) } : item));
  return withItems(scope, items);
}

export function setItemReview(scope: ScopeModel, id: string, review: ReviewStatus): ScopeModel {
  requireItem(scope, id);
  const items = scope.items.map((item) => (item.id === id ? { ...item, review } : item));
  return withItems(scope, items);
}

/** Bulk-approves every item still `pending`; items already approved or rejected are untouched. */
export function approveAllPending(scope: ScopeModel): ScopeModel {
  const items = scope.items.map((item) => (item.review === 'pending' ? { ...item, review: 'approved' as const } : item));
  return withItems(scope, items);
}

/**
 * Answers a question, validates an assumption, or closes a gap. Applies only to those three kinds
 * (per spec section 1, only they carry an open/resolved state); calling it on any other kind is a
 * silent no-op, matching "ignore other kinds" rather than raising for what is a harmless mistake.
 */
export function resolveItem(scope: ScopeModel, id: string, resolution: string): ScopeModel {
  const item = requireItem(scope, id);
  if (!RESOLVABLE_KINDS.has(item.kind)) {
    return scope;
  }
  const items = scope.items.map((candidate) => (candidate.id === id ? { ...candidate, resolved: true, resolution } : candidate));
  return withItems(scope, items);
}

/** Reverses `resolveItem`, clearing the resolution text so the item reads as open again. */
export function reopenItem(scope: ScopeModel, id: string): ScopeModel {
  const item = requireItem(scope, id);
  if (!RESOLVABLE_KINDS.has(item.kind)) {
    return scope;
  }
  const items = scope.items.map((candidate) => (candidate.id === id ? { ...candidate, resolved: false, resolution: '' } : candidate));
  return withItems(scope, items);
}

/**
 * Marks the current version as approved - the gate for all downstream generation (spec section 1:
 * "Users must be able to review the analyzed scope before generating downstream deliverables").
 * Throws `ScopeApprovalError` unless every item has been explicitly accepted or rejected; silently
 * treating leftover `pending` items as approved would let unreviewed content flow into the PRD,
 * architecture and estimate.
 *
 * `now` defaults to the current time for convenience, but callers that need a reproducible result
 * (tests, replaying a package export) can pass it explicitly and keep the call pure.
 */
export function approveScope(scope: ScopeModel, now: string = new Date().toISOString()): ScopeModel {
  const pendingItemIds = scope.items.filter((item) => item.review === 'pending').map((item) => item.id);
  if (pendingItemIds.length > 0) {
    throw new ScopeApprovalError(pendingItemIds);
  }
  return { ...scope, approvedAt: now, approvedVersion: scope.version };
}

/** True when the model's current version has been approved (approval is invalidated by any later edit). */
export function isScopeApproved(scope: ScopeModel | null): boolean {
  return scope !== null && scope.approvedVersion !== null && scope.approvedVersion === scope.version;
}
