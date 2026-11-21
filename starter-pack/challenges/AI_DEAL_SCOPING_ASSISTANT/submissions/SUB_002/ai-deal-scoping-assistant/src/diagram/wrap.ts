/** Pure text-wrapping helpers shared by every diagram renderer (SVG boxes, gutter labels). */

/** Splits a single long word (no spaces) into `maxChars`-wide chunks so it can never overflow a line. */
function splitLongWord(word: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let rest = word;
  while (rest.length > maxChars) {
    chunks.push(rest.slice(0, maxChars));
    rest = rest.slice(maxChars);
  }
  chunks.push(rest);
  return chunks;
}

/**
 * Greedy word-wrap into lines of at most `maxChars` characters. A single word longer than
 * `maxChars` is hard-broken so no rendered line can ever exceed the budget. Pure and deterministic;
 * an empty or whitespace-only `text` yields an empty array.
 */
export function wrapLabel(text: string, maxChars: number): string[] {
  const safeMax = Math.max(1, maxChars);
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= safeMax) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
    if (word.length <= safeMax) {
      current = word;
      continue;
    }
    const chunks = splitLongWord(word, safeMax);
    const lastIndex = chunks.length - 1;
    chunks.forEach((chunk, index) => {
      if (index === lastIndex) {
        current = chunk;
      } else {
        lines.push(chunk);
      }
    });
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

/** Wraps `text` and keeps only the first `maxLines`, marking a cut final line with an ellipsis. */
export function wrapLabelToLines(text: string, maxChars: number, maxLines: number): string[] {
  const lines = wrapLabel(text, maxChars);
  if (lines.length <= maxLines) {
    return lines;
  }
  const kept = lines.slice(0, maxLines);
  const lastKeptIndex = kept.length - 1;
  const lastLine = kept.at(lastKeptIndex) ?? '';
  const trimmedLast = lastLine.length > maxChars - 1 ? lastLine.slice(0, Math.max(0, maxChars - 1)) : lastLine;
  return kept.map((line, index) => (index === lastKeptIndex ? `${trimmedLast}…` : line));
}

/** Truncates single-line fields (sublabels, ref lists) to `maxChars`, marking a cut with an ellipsis. */
export function truncateText(text: string, maxChars: number): string {
  const safeMax = Math.max(1, maxChars);
  return text.length <= safeMax ? text : `${text.slice(0, Math.max(0, safeMax - 1))}…`;
}
