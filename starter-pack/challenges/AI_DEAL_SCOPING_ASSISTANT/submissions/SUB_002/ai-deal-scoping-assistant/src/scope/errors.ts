/** Errors raised by scope-model management (see index.ts for the functions that throw them). */

/**
 * Thrown by `approveScope` when one or more items are still `pending`. Approval is the gate for
 * every downstream generation stage, so it must be an explicit, informed decision: the caller is
 * required to accept or reject every item first rather than have approval silently accept the
 * remaining pending items on the reviewer's behalf.
 */
export class ScopeApprovalError extends Error {
  readonly pendingItemIds: readonly string[];

  constructor(pendingItemIds: readonly string[]) {
    super(
      `Scope cannot be approved: ${pendingItemIds.length} item(s) are still pending review (${pendingItemIds.join(', ')}). ` +
        'Approve or reject each item before approving the scope.',
    );
    this.name = 'ScopeApprovalError';
    this.pendingItemIds = pendingItemIds;
  }
}

/** Thrown when a function is given a scope-item id that does not exist in the model. */
export class ScopeItemNotFoundError extends Error {
  readonly itemId: string;

  constructor(itemId: string) {
    super(`No scope item with id "${itemId}".`);
    this.name = 'ScopeItemNotFoundError';
    this.itemId = itemId;
  }
}
