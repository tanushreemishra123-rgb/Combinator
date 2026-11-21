/** Unit tests for the "Review the extracted scope" filtering/search/sort logic. */
import type { ScopeItem } from '../../../domain';
import { defaultScopeFilterState } from '../types';
import { filterScopeItems } from './scopeFilters';

function makeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id' | 'kind'>): ScopeItem {
  return {
    title: 'Untitled',
    description: 'No description.',
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    signals: [],
    review: 'pending',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
    ...overrides,
  };
}

const ITEMS: ScopeItem[] = [
  makeItem({ id: 'FR_02', kind: 'functional', title: 'Second functional requirement', provenance: 'ai-inferred', priority: 'Low' }),
  makeItem({ id: 'FR_01', kind: 'functional', title: 'Registration and sign-in', description: 'Members register and sign in with SSO.', priority: 'High' }),
  makeItem({ id: 'GAP_01', kind: 'gap', title: 'CRM readiness unknown', review: 'approved' }),
  makeItem({ id: 'PER_01', kind: 'persona', title: 'Member persona', review: 'rejected' }),
];

describe('filterScopeItems', () => {
  it('keeps only the kinds in the active kind group', () => {
    const result = filterScopeItems(ITEMS, defaultScopeFilterState('requirements'));
    expect(result.map((item) => item.id)).toEqual(['FR_01', 'FR_02']);
  });

  it('sorts by the specification kind order and structured id within a group', () => {
    const result = filterScopeItems(ITEMS, defaultScopeFilterState('requirements'));
    expect(result.map((item) => item.id)).toEqual(['FR_01', 'FR_02']);
  });

  it('filters the missing-information group to gaps, assumptions and questions', () => {
    const result = filterScopeItems(ITEMS, defaultScopeFilterState('missing'));
    expect(result.map((item) => item.id)).toEqual(['GAP_01']);
  });

  it('narrows by provenance', () => {
    const result = filterScopeItems(ITEMS, { ...defaultScopeFilterState('requirements'), provenance: 'ai-inferred' });
    expect(result.map((item) => item.id)).toEqual(['FR_02']);
  });

  it('narrows by priority', () => {
    const result = filterScopeItems(ITEMS, { ...defaultScopeFilterState('requirements'), priority: 'High' });
    expect(result.map((item) => item.id)).toEqual(['FR_01']);
  });

  it('narrows by review state', () => {
    const result = filterScopeItems(ITEMS, { ...defaultScopeFilterState('context'), review: 'rejected' });
    expect(result.map((item) => item.id)).toEqual(['PER_01']);
  });

  it('matches the search term against id, title and description, case-insensitively', () => {
    const byId = filterScopeItems(ITEMS, { ...defaultScopeFilterState('requirements'), search: 'fr_01' });
    expect(byId.map((item) => item.id)).toEqual(['FR_01']);

    const byDescription = filterScopeItems(ITEMS, { ...defaultScopeFilterState('requirements'), search: 'SSO' });
    expect(byDescription.map((item) => item.id)).toEqual(['FR_01']);
  });

  it('returns nothing when no item in the group matches every active filter', () => {
    const result = filterScopeItems(ITEMS, { ...defaultScopeFilterState('requirements'), search: 'no such item' });
    expect(result).toEqual([]);
  });
});
