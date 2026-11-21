import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeModel } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { formatList, isInternalOnlyAudience, isLaterPhase, labelWithPhaseNote, matchingExternalSystems, relatedExternalSystemTitles } from './scopeQueries';

function withItems(extra: ScopeItem[]): ScopeModel {
  const scope = fixtureScope();
  return { ...scope, items: [...scope.items, ...extra] };
}

function existingSystem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((i) => i.id === 'SYS_01');
  if (base === undefined) throw new Error('fixture missing SYS_01');
  return { ...base, ...overrides };
}

function integrationItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((i) => i.id === 'INT_01');
  if (base === undefined) throw new Error('fixture missing INT_01');
  return { ...base, ...overrides };
}

describe('formatList', () => {
  it('renders 0, 1, 2 and 3+ items the way generated narrative lists them', () => {
    expect(formatList([])).toBe('');
    expect(formatList(['a'])).toBe('a');
    expect(formatList(['a', 'b'])).toBe('a and b');
    expect(formatList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('isInternalOnlyAudience', () => {
  it('is false when no persona has been reviewed yet', () => {
    const scope: ScopeModel = { ...fixtureScope(), items: fixtureScope().items.filter((i) => i.kind !== 'persona') };
    expect(isInternalOnlyAudience(scope)).toBe(false);
  });

  it('is false when at least one persona reads as an external end user (fixture Member persona)', () => {
    expect(isInternalOnlyAudience(fixtureScope())).toBe(false);
  });

  it('is true only once every reviewed persona reads as internal staff', () => {
    const scope: ScopeModel = {
      ...fixtureScope(),
      items: [
        ...fixtureScope().items.filter((i) => i.kind !== 'persona'),
        { ...fixtureScope().items.find((i) => i.id === 'PER_01') as ScopeItem, title: 'Operations Analyst', description: 'Internal operations staff who review queues.' },
      ],
    };
    expect(isInternalOnlyAudience(scope)).toBe(true);
  });
});

describe('isLaterPhase / labelWithPhaseNote', () => {
  it('recognizes the phrases the analysis stage uses for a deferred item', () => {
    const item = integrationItem({ title: 'CareEverywhere query (later phase)', description: '' });
    expect(isLaterPhase(item)).toBe(true);
  });

  it('is false for an ordinary in-scope item', () => {
    expect(isLaterPhase(integrationItem({}))).toBe(false);
  });

  it('appends the note once, never doubling it when the label already carries it', () => {
    const later = integrationItem({ title: 'Deferred to a later phase', description: '' });
    expect(labelWithPhaseNote('System X', later)).toBe('System X (later phase)');
    expect(labelWithPhaseNote('System X (later phase)', later)).toBe('System X (later phase)');
  });
});

describe('matchingExternalSystems', () => {
  it('ranks the most specific match (most shared signals) first', () => {
    const scope = withItems([
      existingSystem({ id: 'SYS_90', title: 'Broad Match System', signals: ['capability:documents'] }),
      existingSystem({ id: 'SYS_91', title: 'Precise Match System', signals: ['capability:documents', 'data:documents'] }),
    ]);
    const item = integrationItem({ id: 'INT_90', signals: ['capability:documents', 'data:documents', 'data:pii'] });
    const matches = matchingExternalSystems(scope, item);
    expect(matches.map((system) => system.id)).toEqual(['SYS_91', 'SYS_90']);
  });

  it('returns an empty list when no existing system shares a signal', () => {
    const item = integrationItem({ id: 'INT_90', signals: ['signal:not-present'] });
    expect(matchingExternalSystems(fixtureScope(), item)).toEqual([]);
  });
});

describe('relatedExternalSystemTitles', () => {
  it('lists a matched system exactly once, even when it is reached through two different citing items', () => {
    const scope = withItems([existingSystem({ id: 'SYS_90', title: 'Shared System', signals: ['data:pii'] })]);
    const itemA = integrationItem({ id: 'INT_90', title: 'Item A', signals: ['data:pii'] });
    const itemB = integrationItem({ id: 'INT_91', title: 'Item B', signals: ['data:pii'] });
    const titles = relatedExternalSystemTitles(scope, [itemA, itemB]);
    expect(titles).toEqual(['Shared System']);
  });

  it('marks a system later-phase if ANY citing item that reaches it is later-phase, without duplicating the entry', () => {
    const scope = withItems([existingSystem({ id: 'SYS_90', title: 'Shared System', signals: ['data:pii'] })]);
    const onTime = integrationItem({ id: 'INT_90', title: 'On-time item', description: '', signals: ['data:pii'] });
    const deferred = integrationItem({ id: 'INT_91', title: 'Deferred item (later phase)', description: '', signals: ['data:pii'] });
    const titles = relatedExternalSystemTitles(scope, [onTime, deferred]);
    expect(titles).toEqual(['Shared System (later phase)']);
  });

  it('never returns a dependency, risk or other non-system item as a title', () => {
    const item = fixtureScope().items.find((i) => i.id === 'INT_01');
    expect(item).toBeDefined();
    const titles = relatedExternalSystemTitles(fixtureScope(), item === undefined ? [] : [item]);
    expect(titles).toEqual(['Salesforce CRM']);
  });
});
