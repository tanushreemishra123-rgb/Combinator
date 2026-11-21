import { describe, expect, it } from 'vitest';
import { formatNumber, joinList, pick, quote, sentence, stableFingerprint, summariseList, unique } from './format';

describe('formatNumber', () => {
  it('formats a large number with thousands separators', () => {
    expect(formatNumber(500000)).toBe('500,000');
  });

  it('formats a small number without separators', () => {
    expect(formatNumber(3)).toBe('3');
  });
});

describe('joinList', () => {
  it('returns the single value unchanged', () => {
    expect(joinList(['a'])).toBe('a');
  });

  it('returns an empty string for an empty list', () => {
    expect(joinList([])).toBe('');
  });

  it('joins two values with "and"', () => {
    expect(joinList(['a', 'b'])).toBe('a and b');
  });

  it('joins three or more values with commas and a final "and"', () => {
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('summariseList', () => {
  it('spells out short lists in full', () => {
    expect(summariseList(['A', 'B'])).toBe('A and B');
  });

  it('summarises long lists as "and N more"', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    expect(summariseList(ids)).toBe('A, B, C, D, E, F and 2 more');
  });
});

describe('unique', () => {
  it('removes duplicates while preserving first-seen order', () => {
    expect(unique(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });
});

describe('pick', () => {
  it('chooses the singular form for a count of one', () => {
    expect(pick('cites', 'cite', 1)).toBe('cites');
  });

  it('chooses the plural form for any other count', () => {
    expect(pick('cites', 'cite', 0)).toBe('cite');
    expect(pick('cites', 'cite', 2)).toBe('cite');
  });
});

describe('quote', () => {
  it('wraps short text in quotation marks', () => {
    expect(quote('Members register')).toBe('"Members register"');
  });

  it('shortens long text and appends an ellipsis inside the quotes', () => {
    const long = 'a'.repeat(200);
    const quoted = quote(long);
    expect(quoted.startsWith('"')).toBe(true);
    expect(quoted.endsWith('..."')).toBe(true);
    expect(quoted.length).toBeLessThan(long.length);
  });
});

describe('sentence', () => {
  it('appends a full stop when missing', () => {
    expect(sentence('This is a sentence')).toBe('This is a sentence.');
  });

  it('leaves an existing terminator untouched', () => {
    expect(sentence('Is this a question?')).toBe('Is this a question?');
    expect(sentence('Wow!')).toBe('Wow!');
  });
});

describe('stableFingerprint', () => {
  it('is identical for two objects with the same values in a different key order', () => {
    const a = { b: 2, a: 1, nested: { y: 2, x: 1 } };
    const b = { a: 1, nested: { x: 1, y: 2 }, b: 2 };
    expect(stableFingerprint(a)).toBe(stableFingerprint(b));
  });

  it('differs when a value differs', () => {
    expect(stableFingerprint({ a: 1 })).not.toBe(stableFingerprint({ a: 2 }));
  });

  it('is order-sensitive for arrays', () => {
    expect(stableFingerprint([1, 2])).not.toBe(stableFingerprint([2, 1]));
  });
});
