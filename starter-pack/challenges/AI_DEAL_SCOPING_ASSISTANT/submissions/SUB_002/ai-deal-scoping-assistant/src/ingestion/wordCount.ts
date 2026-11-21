/** Word counting that stays meaningful for scripts (e.g. CJK) that do not separate words with spaces. */
const FALLBACK_WORD_PATTERN = /\S+/g;

function hasSegmenter(): boolean {
  return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
}

/**
 * Uses `Intl.Segmenter` (locale-aware word boundaries) when available, which is what makes this
 * work for non-Latin text; falls back to whitespace splitting on runtimes without it.
 */
export function countWords(text: string): number {
  if (text.trim().length === 0) {
    return 0;
  }
  if (hasSegmenter()) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    let count = 0;
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) {
        count += 1;
      }
    }
    return count;
  }
  const matches = text.match(FALLBACK_WORD_PATTERN);
  return matches === null ? 0 : matches.length;
}
