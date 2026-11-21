import { countWords } from './wordCount';

describe('countWords', () => {
  it('counts space-separated Latin words', () => {
    expect(countWords('The quick brown fox jumps')).toBe(5);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('does not count punctuation as its own word', () => {
    expect(countWords('Hello, world!')).toBe(2);
  });

  it('produces a non-zero count for CJK text with no spaces', () => {
    expect(countWords('这是一个测试句子')).toBeGreaterThan(0);
  });
});
