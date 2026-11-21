import { describe, expect, it } from 'vitest';
import { fixtureScope } from '../test/fixtures';
import {
  findItem,
  getActiveItems,
  getExcludedRequirements,
  getInScopeItemsByKind,
  getItemsByKind,
  getOpenGaps,
  getOpenQuestions,
  getRequirements,
  getUnvalidatedAssumptions,
  knownIds,
} from './selectors';
import { resolveItem, setItemReview, updateScopeItem } from './model';

describe('getActiveItems', () => {
  it('excludes rejected items only', () => {
    const scope = setItemReview(fixtureScope(), 'FR_02', 'rejected');
    const active = getActiveItems(scope);
    expect(active.some((item) => item.id === 'FR_02')).toBe(false);
    expect(active.length).toBe(scope.items.length - 1);
  });
});

describe('getRequirements', () => {
  it('returns only requirement-kind items that are active and in scope', () => {
    const requirements = getRequirements(fixtureScope());
    expect(requirements.every((item) => ['business', 'functional', 'nonFunctional', 'integration', 'data', 'security'].includes(item.kind))).toBe(true);
    expect(requirements.some((item) => item.id === 'FR_01')).toBe(true);
    expect(requirements.some((item) => item.id === 'ASM_01')).toBe(false);
  });

  it('excludes a requirement that has been toggled out of scope', () => {
    const scope = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    expect(getRequirements(scope).some((item) => item.id === 'FR_02')).toBe(false);
  });

  it('excludes a rejected requirement even if still in scope', () => {
    const scope = setItemReview(fixtureScope(), 'FR_02', 'rejected');
    expect(getRequirements(scope).some((item) => item.id === 'FR_02')).toBe(false);
  });
});

describe('getItemsByKind', () => {
  it('returns active items of the given kind only', () => {
    const items = getItemsByKind(fixtureScope(), 'question');
    expect(items.map((item) => item.id).sort()).toEqual(['Q_01', 'Q_02']);
  });

  it('still lists an item the reviewer excluded, so change impact can show it', () => {
    const scope = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    expect(getItemsByKind(scope, 'functional').some((item) => item.id === 'FR_02')).toBe(true);
  });
});

describe('getInScopeItemsByKind', () => {
  it('drops items the reviewer excluded as well as rejected ones', () => {
    const excluded = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    const scope = setItemReview(excluded, 'FR_03', 'rejected');
    const ids = getInScopeItemsByKind(scope, 'functional').map((item) => item.id);
    expect(ids).toContain('FR_01');
    expect(ids).not.toContain('FR_02');
    expect(ids).not.toContain('FR_03');
  });
});

describe('getExcludedRequirements', () => {
  it('includes requirements explicitly toggled out of scope', () => {
    const scope = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    const excluded = getExcludedRequirements(scope);
    expect(excluded.some((item) => item.id === 'FR_02')).toBe(true);
  });

  it('includes rejected requirements regardless of the inScope flag', () => {
    const scope = setItemReview(fixtureScope(), 'FR_02', 'rejected');
    const excluded = getExcludedRequirements(scope);
    expect(excluded.some((item) => item.id === 'FR_02')).toBe(true);
  });

  it('excludes non-requirement kinds even when out of scope', () => {
    const scope = updateScopeItem(fixtureScope(), 'ASM_01', { inScope: false });
    expect(getExcludedRequirements(scope).some((item) => item.id === 'ASM_01')).toBe(false);
  });

  it('does not include requirements that are active and in scope', () => {
    expect(getExcludedRequirements(fixtureScope())).toEqual([]);
  });
});

describe('open-item selectors', () => {
  it('getOpenQuestions returns unresolved, active questions only', () => {
    expect(getOpenQuestions(fixtureScope()).map((item) => item.id).sort()).toEqual(['Q_01', 'Q_02']);
  });

  it('getUnvalidatedAssumptions returns unresolved, active assumptions only', () => {
    expect(getUnvalidatedAssumptions(fixtureScope()).map((item) => item.id)).toEqual(['ASM_01']);
  });

  it('getOpenGaps returns unresolved, active gaps only', () => {
    expect(getOpenGaps(fixtureScope()).map((item) => item.id)).toEqual(['GAP_01']);
  });

  it('a resolved question no longer counts as open', () => {
    const scope = resolveItem(fixtureScope(), 'Q_01', 'Okta is the identity provider.');
    expect(getOpenQuestions(scope).some((item) => item.id === 'Q_01')).toBe(false);
  });
});

describe('findItem', () => {
  it('returns the matching item', () => {
    expect(findItem(fixtureScope(), 'FR_01')?.title).toBe('Registration, SSO sign-in and profile');
  });

  it('returns undefined for an unknown id', () => {
    expect(findItem(fixtureScope(), 'FR_99')).toBeUndefined();
  });
});

describe('knownIds', () => {
  it('includes ids of active, in-scope items of any kind', () => {
    const ids = knownIds(fixtureScope());
    expect(ids.has('FR_01')).toBe(true);
    expect(ids.has('ASM_01')).toBe(true); // assumptions are citable too
    expect(ids.has('GAP_01')).toBe(true);
  });

  it('excludes rejected and out-of-scope items', () => {
    const scope = setItemReview(updateScopeItem(fixtureScope(), 'FR_02', { inScope: false }), 'DEP_01', 'rejected');
    const ids = knownIds(scope);
    expect(ids.has('FR_02')).toBe(false);
    expect(ids.has('DEP_01')).toBe(false);
  });
});
