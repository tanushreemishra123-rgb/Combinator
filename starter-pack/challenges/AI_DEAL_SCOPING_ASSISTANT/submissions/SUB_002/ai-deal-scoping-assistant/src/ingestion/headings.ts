/** Heading detection heuristics used to split normalised requirements text into sections. */
export interface HeadingMatch {
  level: number;
  title: string;
}

const MAX_HEADING_LENGTH = 80;
const TERMINAL_PUNCTUATION: readonly string[] = ['.', '!', '?', ',', ';'];
const TRAILING_DOTS_PATTERN = /\.+$/;

/** `# Title` .. `###### Title` - level is the number of hashes. */
function matchMarkdownHeading(trimmed: string): HeadingMatch | null {
  const match = /^(#{1,6})\s+(\S.*)$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const hashes = match.at(1) ?? '';
  const title = (match.at(2) ?? '').trim();
  return title.length === 0 ? null : { level: hashes.length, title };
}

/** `1. Title` / `2.3 Title` - short, and the title does not end mid-sentence. */
function matchNumberedHeading(trimmed: string): HeadingMatch | null {
  if (trimmed.length > MAX_HEADING_LENGTH) {
    return null;
  }
  const match = /^([0-9.]+)\s+(\S.*)$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const numbering = (match.at(1) ?? '').replace(TRAILING_DOTS_PATTERN, '');
  const title = (match.at(2) ?? '').trim();
  if (numbering.length === 0 || title.length === 0) {
    return null;
  }
  const lastChar = title.at(-1) ?? '';
  if (TERMINAL_PUNCTUATION.includes(lastChar)) {
    return null;
  }
  const segments = numbering.split('.').filter((part) => part.length > 0);
  return { level: segments.length > 0 ? segments.length : 1, title };
}

/** A short line that is entirely upper case (and contains at least one letter). */
function matchAllCapsHeading(trimmed: string): HeadingMatch | null {
  if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) {
    return null;
  }
  if (!/[A-Z]/.test(trimmed) || /[a-z]/.test(trimmed)) {
    return null;
  }
  return { level: 1, title: trimmed };
}

/** A short line ending in `:` that is actually followed by content (not a trailing label). */
function matchColonHeading(trimmed: string, hasFollowingContent: boolean): HeadingMatch | null {
  if (!hasFollowingContent || trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) {
    return null;
  }
  if (!trimmed.endsWith(':')) {
    return null;
  }
  const title = trimmed.slice(0, -1).trim();
  return title.length === 0 ? null : { level: 2, title };
}

/**
 * Classifies `line` as a section heading, trying the most explicit styles first.
 * `nextNonBlank` (the next non-blank line's text, if any) is needed to tell a genuine
 * `Section:` heading from a trailing label with nothing under it.
 */
export function detectHeading(line: string, nextNonBlank: string | undefined): HeadingMatch | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const hasFollowingContent = nextNonBlank !== undefined && nextNonBlank.trim().length > 0;
  return (
    matchMarkdownHeading(trimmed) ??
    matchNumberedHeading(trimmed) ??
    matchAllCapsHeading(trimmed) ??
    matchColonHeading(trimmed, hasFollowingContent)
  );
}
