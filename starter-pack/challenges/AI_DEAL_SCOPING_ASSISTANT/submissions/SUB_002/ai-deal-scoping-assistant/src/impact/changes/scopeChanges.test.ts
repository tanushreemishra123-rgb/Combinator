import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeModel } from '../../domain';
import { fixtureScope } from '../../test/fixtures';
import { firstOrThrow } from '../testFixtures.data';
import { describeScopeChanges } from './scopeChanges';

function model(items: readonly ScopeItem[]): ScopeModel {
  return { summary: 'test', items: [...items], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
}

function findItem(scope: ScopeModel, id: string): ScopeItem {
  const item = scope.items.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Fixture item ${id} not found`);
  }
  return item;
}

describe('describeScopeChanges', () => {
  it('reports nothing while either snapshot has no scope model yet', () => {
    expect(describeScopeChanges(null, fixtureScope())).toEqual([]);
    expect(describeScopeChanges(fixtureScope(), null)).toEqual([]);
  });

  it('reports nothing when the scope model is unchanged', () => {
    const scope = fixtureScope();
    expect(describeScopeChanges(scope, { ...scope, items: [...scope.items] })).toEqual([]);
  });

  it('reports a priority change', () => {
    const before = fixtureScope();
    const fr02 = findItem(before, 'FR_02');
    const after = model(before.items.map((item) => (item.id === 'FR_02' ? { ...item, priority: 'High' } : item)));
    const changes = describeScopeChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes.at(0)).toMatchObject({ kind: 'requirement-priority', targetId: 'FR_02', from: fr02.priority, to: 'High' });
  });

  it('reports a wording change as requirement-text for a functional item', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'FR_02' ? { ...item, description: 'Members search, filter and download their policy documents.' } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change.kind).toBe('requirement-text');
    expect(change.targetId).toBe('FR_02');
  });

  it('reports a wording change as security-requirement for a security item', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'SEC_01' ? { ...item, description: 'Encrypt personal data at rest and in transit using AES-256 and comply with GDPR.' } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change.kind).toBe('security-requirement');
    expect(change.targetId).toBe('SEC_01');
  });

  it('reports a wording change as assumption for an assumption item', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'ASM_01' ? { ...item, description: 'Policy documents are digitised and stored as searchable PDFs.' } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change.kind).toBe('assumption');
    expect(change.targetId).toBe('ASM_01');
  });

  it('reports a scope-inclusion change when an item is taken out of scope', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'FR_03' ? { ...item, inScope: false } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'scope-inclusion', targetId: 'FR_03', from: 'In scope', to: 'Out of scope' });
  });

  it('reports a scope-inclusion change when an item is rejected in review', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'FR_03' ? { ...item, review: 'rejected' } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'scope-inclusion', targetId: 'FR_03', to: 'Rejected' });
  });

  it('reports a newly added item as a scope-inclusion change', () => {
    const before = fixtureScope();
    const added: ScopeItem = { ...findItem(before, 'FR_02'), id: 'FR_99', title: 'Bulk export', description: 'Members export all documents at once.' };
    const after = model([...before.items, added]);
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'scope-inclusion', targetId: 'FR_99', from: 'Not in the scope model' });
    expect(change.label).toContain('was added to the scope model');
  });

  it('reports a removed item as a scope-inclusion change', () => {
    const before = fixtureScope();
    const after = model(before.items.filter((item) => item.id !== 'RSK_01'));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'scope-inclusion', targetId: 'RSK_01', to: 'Removed from the scope model' });
  });

  it('reports a question being answered as question-resolved', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'Q_01' ? { ...item, resolved: true, resolution: 'Azure AD B2C.' } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'question-resolved', targetId: 'Q_01', from: 'Open', to: 'Answered' });
    expect(change.label).toContain('Azure AD B2C');
  });

  it('reports a gap being closed as question-resolved', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'GAP_01' ? { ...item, resolved: true } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'question-resolved', targetId: 'GAP_01', from: 'Open', to: 'Closed' });
  });

  it('reports an assumption being validated as an assumption change', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'ASM_01' ? { ...item, resolved: true } : item)));
    const change = firstOrThrow(describeScopeChanges(before, after));
    expect(change).toMatchObject({ kind: 'assumption', targetId: 'ASM_01', from: 'Unvalidated', to: 'Validated' });
  });

  it('reports several independent edits to the same item together', () => {
    const before = fixtureScope();
    const after = model(before.items.map((item) => (item.id === 'FR_02' ? { ...item, priority: 'High', inScope: false } : item)));
    const changes = describeScopeChanges(before, after);
    expect(changes.map((change) => change.kind).sort()).toEqual(['requirement-priority', 'scope-inclusion']);
  });
});
