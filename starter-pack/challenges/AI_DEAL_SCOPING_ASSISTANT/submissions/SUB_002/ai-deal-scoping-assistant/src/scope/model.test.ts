import { describe, expect, it } from 'vitest';
import type { ScopeModel } from '../domain';
import { ScopeApprovalError, ScopeItemNotFoundError } from './errors';
import {
  addScopeItem,
  approveAllPending,
  approveScope,
  createScopeModel,
  isScopeApproved,
  removeScopeItem,
  reopenItem,
  resolveItem,
  setItemReview,
  updateScopeItem,
} from './model';
import type { ScopeDraftInput } from './types';

function makeDraft(overrides: Partial<ScopeDraftInput> & Pick<ScopeDraftInput, 'id' | 'kind' | 'title' | 'description'>): ScopeDraftInput {
  return {
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    ...overrides,
  };
}

/** A small model: one functional requirement (depends on a question) and the question itself. */
function baseModel(): ScopeModel {
  return createScopeModel('Member self-service portal.', [
    makeDraft({ id: 'FR_01', kind: 'functional', title: 'Registration', description: 'Members can register.', relatedIds: ['Q_01'] }),
    makeDraft({ id: 'Q_01', kind: 'question', title: 'Which IdP?', description: 'Which identity provider?', provenance: 'ai-inferred' }),
  ]);
}

/** Approves every item of `scope` (test helper, not part of the public API). */
function approveEveryItem(scope: ScopeModel): ScopeModel {
  return scope.items.reduce((acc, item) => setItemReview(acc, item.id, 'approved'), scope);
}

describe('createScopeModel', () => {
  it('defaults every item to pending review, in scope, unedited and unresolved', () => {
    const scope = createScopeModel('Summary', [makeDraft({ id: 'FR_01', kind: 'functional', title: 'T', description: 'D' })]);
    const [item] = scope.items;
    expect(item).toMatchObject({ review: 'pending', inScope: true, userEdited: false, resolved: false, resolution: '', signals: [] });
  });

  it('preserves signals already tagged on a draft', () => {
    const scope = createScopeModel('Summary', [
      makeDraft({ id: 'FR_01', kind: 'functional', title: 'T', description: 'D', signals: ['capability:search'] }),
    ]);
    expect(scope.items.at(0)?.signals).toEqual(['capability:search']);
  });

  it('starts at version 1, unapproved, with the given summary', () => {
    const scope = createScopeModel('Member portal', []);
    expect(scope).toMatchObject({ summary: 'Member portal', version: 1, approvedAt: null, approvedVersion: null, issues: [] });
  });

  it('starts a requirement out of scope when the customer wording excludes it, and says it can be included again', () => {
    const quote = 'INT5. Query the regional exchange in a later phase, but that integration is not required for go-live.';
    const source = { sectionId: 's1', sectionTitle: 'Integrations', lineStart: 9, lineEnd: 9, quote, verified: true };
    const scope = createScopeModel('Summary', [
      makeDraft({ id: 'INT_05', kind: 'integration', title: 'Exchange query', description: 'Query the exchange later.', source }),
      makeDraft({ id: 'BR_05', kind: 'business', title: 'Screening', description: 'A future candidate, explicitly out of scope for this phase.' }),
      makeDraft({ id: 'GAP_03', kind: 'gap', title: 'Phase unknown', description: 'Target phase not set.', source }),
    ]);
    expect(scope.items.map((item) => [item.id, item.inScope])).toEqual([
      ['INT_05', false],
      ['BR_05', false],
      ['GAP_03', true],
    ]);
    expect(scope.issues.map((issue) => [issue.severity, issue.code, issue.refs])).toEqual([
      ['info', 'customer-excluded', ['INT_05']],
      ['info', 'customer-excluded', ['BR_05']],
    ]);
    expect(scope.issues.at(0)?.message).toContain('back into scope');
  });

  it('keeps a requirement in scope when it only mentions a later phase', () => {
    const scope = createScopeModel('Summary', [
      makeDraft({ id: 'FR_07', kind: 'functional', title: 'Reports', description: 'Monthly reports, with dashboards in a later phase.' }),
    ]);
    expect(scope.items.at(0)?.inScope).toBe(true);
    expect(scope.issues).toEqual([]);
  });

  it('lets an approved model carry a requirement the customer excluded', () => {
    const scope = createScopeModel('Summary', [
      makeDraft({ id: 'BR_05', kind: 'business', title: 'Screening', description: 'That is not in scope for this phase.' }),
    ]);
    const approved = approveScope(approveAllPending(scope), '2026-01-01T00:00:00.000Z');
    expect(isScopeApproved(approved)).toBe(true);
    expect(approved.items.at(0)).toMatchObject({ review: 'approved', inScope: false });
  });
});

describe('updateScopeItem provenance guard', () => {
  it('keeps a sourceless item from being relabelled customer-stated but applies the rest of the edit', () => {
    const scope = addScopeItem(baseModel(), 'functional', { title: 'Bulk export', description: 'Export claims to CSV.', priority: 'Low' });
    const added = scope.items.at(-1);
    const updated = updateScopeItem(scope, added?.id ?? '', { provenance: 'customer-stated', title: 'Bulk CSV export' });
    expect(updated.items.at(-1)).toMatchObject({ provenance: 'assumed', title: 'Bulk CSV export' });
  });

  it('allows customer-stated when grounding verified the customer source', () => {
    const source = { sectionId: 's1', sectionTitle: 'Scope', lineStart: 4, lineEnd: 4, quote: 'Members can register.', verified: true };
    const scope = createScopeModel('Summary', [makeDraft({ id: 'FR_01', kind: 'functional', title: 'T', description: 'D', provenance: 'ai-inferred', source })]);
    expect(updateScopeItem(scope, 'FR_01', { provenance: 'customer-stated' }).items.at(0)?.provenance).toBe('customer-stated');
  });
});

describe('updateScopeItem', () => {
  it('bumps the version, marks the item edited, and keeps other fields', () => {
    const scope = baseModel();
    const updated = updateScopeItem(scope, 'FR_01', { title: 'Registration and SSO' });
    expect(updated.version).toBe(scope.version + 1);
    const item = updated.items.find((candidate) => candidate.id === 'FR_01');
    expect(item).toMatchObject({ title: 'Registration and SSO', userEdited: true, description: 'Members can register.' });
  });

  it('keeps provenance unless the patch sets it explicitly', () => {
    const scope = baseModel();
    const untouched = updateScopeItem(scope, 'FR_01', { title: 'Renamed' });
    expect(untouched.items.find((item) => item.id === 'FR_01')?.provenance).toBe('customer-stated');

    const reclassified = updateScopeItem(scope, 'FR_01', { provenance: 'assumed' });
    expect(reclassified.items.find((item) => item.id === 'FR_01')?.provenance).toBe('assumed');
  });

  it('never mutates the input model', () => {
    const scope = baseModel();
    const before = JSON.stringify(scope);
    updateScopeItem(scope, 'FR_01', { title: 'Changed' });
    expect(JSON.stringify(scope)).toBe(before);
  });

  it('un-approves the model: approvedVersion stays behind while approvedAt is kept', () => {
    const approved = approveScope(approveEveryItem(baseModel()), '2026-01-01T00:00:00.000Z');
    expect(isScopeApproved(approved)).toBe(true);

    const edited = updateScopeItem(approved, 'FR_01', { title: 'Post-approval edit' });
    expect(edited.approvedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(edited.approvedVersion).toBe(approved.version);
    expect(edited.version).not.toBe(edited.approvedVersion);
    expect(isScopeApproved(edited)).toBe(false);
  });

  it('throws for an unknown id', () => {
    expect(() => updateScopeItem(baseModel(), 'FR_99', { title: 'x' })).toThrow(ScopeItemNotFoundError);
  });
});

describe('addScopeItem', () => {
  it('assigns the next structured id for the kind', () => {
    const scope = addScopeItem(baseModel(), 'functional', { title: 'Profile update', description: 'Members update their profile.', priority: 'Medium' });
    expect(scope.items.find((item) => item.title === 'Profile update')?.id).toBe('FR_02');
  });

  it('is always assumed, sourceless and marked user-edited - never customer-stated', () => {
    const scope = addScopeItem(baseModel(), 'risk', { title: 'Vendor risk', description: 'Vendor may miss the deadline.', priority: 'Low' });
    const added = scope.items.find((item) => item.title === 'Vendor risk');
    expect(added).toMatchObject({ provenance: 'assumed', source: null, userEdited: true, review: 'pending', inScope: true });
  });

  it('applies the optional fields and defaults the rest', () => {
    const scope = addScopeItem(baseModel(), 'assumption', {
      title: 'Docs digitised',
      description: 'Policy docs are text-searchable.',
      priority: 'Medium',
      critical: true,
      relatedIds: ['FR_01'],
    });
    const added = scope.items.find((item) => item.title === 'Docs digitised');
    expect(added).toMatchObject({ critical: true, relatedIds: ['FR_01'], affectsInputs: [], signals: [] });
  });

  it('bumps the version', () => {
    const scope = baseModel();
    const added = addScopeItem(scope, 'risk', { title: 'R', description: 'D', priority: 'Low' });
    expect(added.version).toBe(scope.version + 1);
  });
});

describe('removeScopeItem', () => {
  it('removes the item and strips its id from other items relatedIds', () => {
    const scope = baseModel();
    expect(scope.items.find((item) => item.id === 'FR_01')?.relatedIds).toContain('Q_01');

    const updated = removeScopeItem(scope, 'Q_01');
    expect(updated.items.find((item) => item.id === 'Q_01')).toBeUndefined();
    expect(updated.items.find((item) => item.id === 'FR_01')?.relatedIds).not.toContain('Q_01');
  });

  it('bumps the version', () => {
    const scope = baseModel();
    expect(removeScopeItem(scope, 'Q_01').version).toBe(scope.version + 1);
  });

  it('throws for an unknown id', () => {
    expect(() => removeScopeItem(baseModel(), 'FR_99')).toThrow(ScopeItemNotFoundError);
  });
});

describe('setItemReview and approveAllPending', () => {
  it('sets a single item review status', () => {
    const scope = setItemReview(baseModel(), 'FR_01', 'rejected');
    expect(scope.items.find((item) => item.id === 'FR_01')?.review).toBe('rejected');
  });

  it('throws for an unknown id', () => {
    expect(() => setItemReview(baseModel(), 'FR_99', 'approved')).toThrow(ScopeItemNotFoundError);
  });

  it('approves only items still pending, leaving others untouched', () => {
    const scope = setItemReview(baseModel(), 'FR_01', 'rejected');
    const result = approveAllPending(scope);
    expect(result.items.find((item) => item.id === 'FR_01')?.review).toBe('rejected');
    expect(result.items.find((item) => item.id === 'Q_01')?.review).toBe('approved');
  });
});

describe('resolveItem and reopenItem', () => {
  it('resolves a question with the given resolution text', () => {
    const scope = resolveItem(baseModel(), 'Q_01', 'Okta is the identity provider.');
    const item = scope.items.find((candidate) => candidate.id === 'Q_01');
    expect(item).toMatchObject({ resolved: true, resolution: 'Okta is the identity provider.' });
  });

  it('reopens a resolved item, clearing the resolution', () => {
    const resolved = resolveItem(baseModel(), 'Q_01', 'Okta.');
    const reopened = reopenItem(resolved, 'Q_01');
    expect(reopened.items.find((item) => item.id === 'Q_01')).toMatchObject({ resolved: false, resolution: '' });
  });

  it('ignores kinds other than question, gap and assumption', () => {
    const scope = baseModel();
    const result = resolveItem(scope, 'FR_01', 'Not applicable');
    expect(result).toBe(scope);
    expect(result.items.find((item) => item.id === 'FR_01')?.resolved).toBe(false);
  });

  it('throws for an unknown id', () => {
    expect(() => resolveItem(baseModel(), 'Q_99', 'x')).toThrow(ScopeItemNotFoundError);
    expect(() => reopenItem(baseModel(), 'Q_99')).toThrow(ScopeItemNotFoundError);
  });
});

describe('approveScope', () => {
  it('throws ScopeApprovalError listing every pending item id', () => {
    const scope = baseModel();
    expect(() => approveScope(scope, '2026-01-01T00:00:00.000Z')).toThrow(ScopeApprovalError);

    let caught: unknown;
    try {
      approveScope(scope, '2026-01-01T00:00:00.000Z');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ScopeApprovalError);
    expect((caught as ScopeApprovalError).pendingItemIds.slice().sort()).toEqual(['FR_01', 'Q_01']);
  });

  it('approves once every item is approved or rejected (rejected counts as decided)', () => {
    const decided = setItemReview(setItemReview(baseModel(), 'FR_01', 'approved'), 'Q_01', 'rejected');
    const approved = approveScope(decided, '2026-01-01T00:00:00.000Z');
    expect(approved.approvedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(approved.approvedVersion).toBe(decided.version);
    expect(isScopeApproved(approved)).toBe(true);
  });

  it('does not itself bump the version', () => {
    const decided = approveEveryItem(baseModel());
    const approved = approveScope(decided, '2026-01-01T00:00:00.000Z');
    expect(approved.version).toBe(decided.version);
  });
});

describe('isScopeApproved', () => {
  it('is false for a null scope', () => {
    expect(isScopeApproved(null)).toBe(false);
  });

  it('is false when the version has moved on from the approved version', () => {
    const approved = approveScope(approveEveryItem(baseModel()), '2026-01-01T00:00:00.000Z');
    const edited = updateScopeItem(approved, 'FR_01', { title: 'Edited' });
    expect(isScopeApproved(edited)).toBe(false);
  });

  it('is true right after approval', () => {
    const approved = approveScope(approveEveryItem(baseModel()), '2026-01-01T00:00:00.000Z');
    expect(isScopeApproved(approved)).toBe(true);
  });
});
