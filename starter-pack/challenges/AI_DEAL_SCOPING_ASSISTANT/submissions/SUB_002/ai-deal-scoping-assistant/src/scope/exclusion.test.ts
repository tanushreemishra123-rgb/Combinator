import { describe, expect, it } from 'vitest';
import { findExclusionCue, isCustomerExcluded } from './exclusion';

describe('findExclusionCue', () => {
  it('finds the customer wording that removes an item from this phase, in any case', () => {
    expect(findExclusionCue('Though that is Out of Scope for this initial phase.')).toBe('out of scope');
    expect(findExclusionCue('That integration is not required for go-live.')).toBe('not required for go-live');
    expect(findExclusionCue('Though that is not in scope for this phase.')).toBe('not in scope');
  });

  it('ignores staged delivery and data-handling wording that keeps the item wanted', () => {
    expect(findExclusionCue('Dashboards follow in a later phase.')).toBeUndefined();
    expect(findExclusionCue('Personal data must be excluded from application logs.')).toBeUndefined();
  });
});

describe('isCustomerExcluded', () => {
  it('checks the customer quote as well as the description', () => {
    const source = { sectionId: 's1', sectionTitle: 'Scope', lineStart: 3, lineEnd: 3, quote: 'That build is out of scope now.', verified: true };
    expect(isCustomerExcluded({ source, description: 'Expose a status API.' })).toBe(true);
    expect(isCustomerExcluded({ source: null, description: 'Expose a status API.' })).toBe(false);
  });
});
