import { describe, expect, it } from 'vitest';
import { formatMoneyRange, formatNumericRange, joinList, notProvidedHint, parseCommaList } from './format';

describe('formatNumericRange', () => {
  it('shows low, high and the likely value', () => {
    expect(formatNumericRange({ low: 100, likely: 120, high: 150 }, 'person-days')).toBe('100 - 150 person-days (likely 120)');
  });

  it('collapses to one value when the range has zero width', () => {
    expect(formatNumericRange({ low: 40, likely: 40, high: 40 }, 'weeks')).toBe('40 weeks (likely 40)');
  });
});

describe('formatMoneyRange', () => {
  it('shows the blocked label when the range is null', () => {
    expect(formatMoneyRange(null)).toBe('Blocked - missing rates');
  });

  it('formats low, high and likely in the configured currency', () => {
    expect(formatMoneyRange({ low: 10_000, likely: 12_000, high: 15_000, currency: 'USD' })).toBe('10,000 USD - 15,000 USD (likely 12,000 USD)');
  });
});

describe('parseCommaList', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseCommaList('US, EU ,  , APAC')).toEqual(['US', 'EU', 'APAC']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseCommaList('   ')).toEqual([]);
  });
});

describe('notProvidedHint', () => {
  it('explains the missing-input consequence when empty', () => {
    expect(notProvidedHint(true)).toContain('missing input');
  });

  it('returns undefined when a value is provided', () => {
    expect(notProvidedHint(false)).toBeUndefined();
  });
});

describe('joinList', () => {
  it('joins two entries with "and"', () => {
    expect(joinList(['a', 'b'])).toBe('a and b');
  });

  it('joins three or more with commas and a final "and"', () => {
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('returns the single entry unchanged', () => {
    expect(joinList(['only'])).toBe('only');
  });

  it('returns an empty string for an empty list', () => {
    expect(joinList([])).toBe('');
  });
});
