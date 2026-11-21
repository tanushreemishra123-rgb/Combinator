import { describe, expect, it } from 'vitest';
import { truncateText, wrapLabel, wrapLabelToLines } from './wrap';

describe('wrapLabel', () => {
  it('returns an empty array for empty or whitespace-only text', () => {
    expect(wrapLabel('', 10)).toEqual([]);
    expect(wrapLabel('   ', 10)).toEqual([]);
  });

  it('keeps short text on one line', () => {
    expect(wrapLabel('Hello world', 20)).toEqual(['Hello world']);
  });

  it('wraps on word boundaries without exceeding maxChars', () => {
    const lines = wrapLabel('Customer onboarding and identity verification', 12);
    expect(lines.every((line) => line.length <= 12)).toBe(true);
    expect(lines.join(' ')).toBe('Customer onboarding and identity verification');
  });

  it('hard-breaks a single word longer than maxChars', () => {
    const lines = wrapLabel('Supercalifragilisticexpialidocious', 10);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
    expect(lines.join('')).toBe('Supercalifragilisticexpialidocious');
  });

  it('treats a maxChars of zero or less as one character', () => {
    const lines = wrapLabel('ab', 0);
    expect(lines.every((line) => line.length <= 1)).toBe(true);
  });
});

describe('wrapLabelToLines', () => {
  it('returns every line when it fits within maxLines', () => {
    expect(wrapLabelToLines('Short label', 20, 3)).toEqual(['Short label']);
  });

  it('truncates to maxLines and marks the cut with an ellipsis', () => {
    const lines = wrapLabelToLines('One two three four five six seven eight nine ten', 8, 2);
    expect(lines).toHaveLength(2);
    expect(lines.at(-1)?.endsWith('…')).toBe(true);
  });
});

describe('truncateText', () => {
  it('leaves text at or under the limit unchanged', () => {
    expect(truncateText('FR_01, FR_02', 20)).toBe('FR_01, FR_02');
  });

  it('truncates and appends an ellipsis when text exceeds the limit', () => {
    const result = truncateText('FR_01, FR_02, FR_03, FR_04, FR_05', 12);
    expect(result.length).toBe(12);
    expect(result.endsWith('…')).toBe(true);
  });
});
