/**
 * Scope review use cases (spec section 1: "review, edit, approve or reject" the analysed scope).
 * Each edit is a pure scope-model function wrapped as a `SessionMutation` and committed through
 * `commitEdit`: a plain save before any deliverable exists, the change-impact flow afterwards.
 */
import type { ReviewStatus, ScopeItemKind, ScopeModel } from '../../domain';
import { detectSignals } from '../../analysis';
import {
  addScopeItem as addItemToScope,
  approveAllPending as approvePendingInScope,
  approveScope as approveScopeModel,
  removeScopeItem as removeItemFromScope,
  reopenItem,
  resolveItem,
  ScopeApprovalError,
  setItemReview as setReviewInScope,
  updateScopeItem,
} from '../../scope';
import type { NewScopeItemFields, ScopeItemPatch } from '../../scope';
import { summarizePendingActions } from '../../impact';
import type { SessionMutation, UseCaseDeps } from '../types';
import { commitEdit } from './changeFlow';
import { describeError, notify, requireActiveSession, saveSession, UseCaseError } from './support';

const NO_SCOPE_MESSAGE = 'Analyze the customer requirements before reviewing the scope.';
const EDIT_ERROR_TITLE = 'Scope could not be updated';

/** How many pending ids an approval error names before summarising the rest. */
const MAX_LISTED_PENDING_IDS = 8;

/** Lifts a pure scope-model edit into a session mutation; a session without a scope cannot be edited. */
function scopeMutation(edit: (scope: ScopeModel) => ScopeModel): SessionMutation {
  return (session) => {
    if (session.scope === null) {
      throw new UseCaseError(NO_SCOPE_MESSAGE);
    }
    return { ...session, scope: edit(session.scope) };
  };
}

/**
 * Re-tags a reworded item with taxonomy signals so downstream planners route it by what it now
 * says. New signals are added to the existing ones rather than replacing them, so a wording tweak
 * never drops a signal the analysis stage found.
 */
function patchWithSignals(scope: ScopeModel, itemId: string, patch: ScopeItemPatch): ScopeItemPatch {
  if (patch.signals !== undefined || (patch.title === undefined && patch.description === undefined)) {
    return patch;
  }
  const item = scope.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    return patch;
  }
  const text = [patch.title ?? item.title, patch.description ?? item.description, item.source?.quote ?? ''].join(' ');
  return { ...patch, signals: [...new Set([...item.signals, ...detectSignals(text)])] };
}

/** Edits the wording, priority, provenance, inclusion or links of one scope item. */
export function editScopeItem(deps: UseCaseDeps, itemId: string, patch: ScopeItemPatch): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => updateScopeItem(scope, itemId, patchWithSignals(scope, itemId, patch))));
}

/**
 * Adds a reviewer-authored item; it is always labelled 'assumed' until someone confirms it. Its
 * signals are detected from its own text so it is planned like an analysed item, not dropped into
 * the catch-all capability.
 */
export function addScopeItem(deps: UseCaseDeps, kind: ScopeItemKind, fields: NewScopeItemFields): Promise<void> {
  const tagged = { ...fields, signals: fields.signals ?? detectSignals(`${fields.title} ${fields.description}`) };
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => addItemToScope(scope, kind, tagged)));
}

export function removeScopeItem(deps: UseCaseDeps, itemId: string): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => removeItemFromScope(scope, itemId)));
}

/** Approves or rejects one item (a rejected item leaves every downstream deliverable). */
export function setItemReview(deps: UseCaseDeps, itemId: string, review: ReviewStatus): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => setReviewInScope(scope, itemId, review)));
}

export function approveAllPending(deps: UseCaseDeps): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation(approvePendingInScope));
}

/** Answers a question, validates an assumption or closes a gap with the reviewer's resolution text. */
export function resolveScopeItem(deps: UseCaseDeps, itemId: string, resolution: string): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => resolveItem(scope, itemId, resolution)));
}

export function reopenScopeItem(deps: UseCaseDeps, itemId: string): Promise<void> {
  return commitEdit(deps, EDIT_ERROR_TITLE, scopeMutation((scope) => reopenItem(scope, itemId)));
}

function describePendingItems(error: ScopeApprovalError): string {
  const listed = error.pendingItemIds.slice(0, MAX_LISTED_PENDING_IDS).join(', ');
  const remaining = error.pendingItemIds.length - MAX_LISTED_PENDING_IDS;
  const suffix = remaining > 0 ? ` and ${remaining} more` : '';
  return `${error.pendingItemIds.length} item(s) are still pending review: ${listed}${suffix}. Approve or reject each item before approving the requirements.`;
}

/**
 * Approves the current scope version - the gate for every generation stage. Approval does not
 * change any reviewed content, so it is saved directly and never logged as a change.
 */
export function approveScope(deps: UseCaseDeps): void {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  if (session.scope === null) {
    notify(deps, 'error', 'Requirements cannot be approved yet', NO_SCOPE_MESSAGE);
    return;
  }
  try {
    const scope = approveScopeModel(session.scope, deps.now());
    const saved = saveSession(deps, { ...session, scope });
    const hasStale = summarizePendingActions(saved).length > 0;
    const next = hasStale ? 'Regenerate the stale deliverables to bring them up to date.' : 'Downstream deliverables can now be generated from it.';
    notify(deps, 'success', 'Requirements approved', `Scope version ${scope.version} is approved. ${next}`);
  } catch (error) {
    const message = error instanceof ScopeApprovalError ? describePendingItems(error) : describeError(error);
    notify(deps, 'error', 'Requirements cannot be approved yet', message);
  }
}
