import { describe, expect, it } from 'vitest';
import { compareScopeItems, kindGroupLabel, kindLabel, provenanceLabel, reviewLabel } from './labels';

describe('display vocabulary', () => {
  it('uses the specification wording for kind labels', () => {
    expect(kindLabel('business')).toBe('Business objective');
    expect(kindLabel('nonFunctional')).toBe('Non-functional requirement');
    expect(kindLabel('question')).toBe('Clarification question');
  });

  it('has a plural group heading distinct from the singular label', () => {
    expect(kindGroupLabel('functional')).toBe('Functional requirements');
  });

  it('labels provenance and review status', () => {
    expect(provenanceLabel('customer-stated')).toBe('Customer-stated');
    expect(provenanceLabel('assumed')).toBe('Assumed');
    expect(reviewLabel('pending')).toBe('Pending review');
  });
});

describe('compareScopeItems', () => {
  it('orders by the specification kind order first', () => {
    const business = { id: 'BR_02', kind: 'business' as const };
    const functional = { id: 'FR_01', kind: 'functional' as const };
    expect(compareScopeItems(business, functional)).toBeLessThan(0);
    expect(compareScopeItems(functional, business)).toBeGreaterThan(0);
  });

  it('orders by numeric-aware id within the same kind', () => {
    const fr9 = { id: 'FR_9', kind: 'functional' as const };
    const fr10 = { id: 'FR_10', kind: 'functional' as const };
    expect(compareScopeItems(fr9, fr10)).toBeLessThan(0);
  });
});
