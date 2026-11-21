/**
 * Turns raw uploaded/pasted text into a `NormalizedDocument`: stable line endings and whitespace,
 * a 1-based line index, and the section structure every scope item's source reference points into.
 */
import type { NormalizedDocument, SourceLine, SourceSection } from '../domain';
import { detectHeading, type HeadingMatch } from './headings';
import { countWords } from './wordCount';

const MIN_BLANK_RUN_TO_COLLAPSE = 3;

/** Byte-order mark (0xFEFF) and zero-width formatting characters (word joiner, ZWSP/ZWNJ/ZWJ). */
const STRIPPABLE_MARK_CODE_POINTS: ReadonlySet<number> = new Set([0xfeff, 0x200b, 0x200c, 0x200d, 0x2060]);

/** C0 control characters and DEL, excluding tab (0x09) and line feed (0x0A) which are handled separately. */
const STRIPPABLE_CONTROL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x7f],
];

function isStrippableControlChar(codePoint: number): boolean {
  return STRIPPABLE_CONTROL_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function isStrippableChar(char: string): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  return STRIPPABLE_MARK_CODE_POINTS.has(codePoint) || isStrippableControlChar(codePoint);
}

/** Removes the BOM, zero-width formatting characters, and C0 control characters (keeping tab/LF). */
function stripInvisibleChars(text: string): string {
  return Array.from(text)
    .filter((char) => !isStrippableChar(char))
    .join('');
}

/** Line endings -> `\n`, BOM / zero-width characters and control characters removed, tabs -> spaces. */
function cleanCharacters(rawText: string): string {
  const unifiedLineEndings = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withoutInvisibleChars = stripInvisibleChars(unifiedLineEndings);
  return withoutInvisibleChars.replace(/\t/g, ' ');
}

/** Runs of 3+ blank lines collapse to exactly one; shorter runs are left as-is. */
function collapseBlankRuns(lines: readonly string[]): string[] {
  const result: string[] = [];
  let blankRun = 0;
  const flushBlankRun = (): void => {
    const toKeep = blankRun >= MIN_BLANK_RUN_TO_COLLAPSE ? 1 : blankRun;
    for (let i = 0; i < toKeep; i += 1) {
      result.push('');
    }
    blankRun = 0;
  };
  for (const line of lines) {
    if (line.length === 0) {
      blankRun += 1;
    } else {
      flushBlankRun();
      result.push(line);
    }
  }
  flushBlankRun();
  return result;
}

function findNextNonBlankIndex(lines: readonly string[], fromIndex: number): number {
  for (let index = fromIndex + 1; index < lines.length; index += 1) {
    const candidate = lines.at(index);
    if (candidate !== undefined && candidate.length > 0) {
      return index;
    }
  }
  return -1;
}

interface HeadingHit {
  lineNumber: number;
  heading: HeadingMatch;
}

function findHeadings(lines: readonly string[]): HeadingHit[] {
  const hits: HeadingHit[] = [];
  lines.forEach((line, index) => {
    const nextIndex = findNextNonBlankIndex(lines, index);
    const nextNonBlank = nextIndex === -1 ? undefined : lines.at(nextIndex);
    const heading = detectHeading(line, nextNonBlank);
    if (heading !== null) {
      hits.push({ lineNumber: index + 1, heading });
    }
  });
  return hits;
}

/**
 * Splits `lines` into sections: any text before the first heading becomes an 'Introduction'
 * section, and every detected heading opens the next one. Sections are numbered S1..Sn.
 */
function buildSections(lines: readonly string[]): { sections: SourceSection[]; sourceLines: SourceLine[] } {
  const headingHits = findHeadings(lines);
  const sections: SourceSection[] = [];
  let sectionIndex = 0;
  const firstHeadingLine = headingHits.at(0)?.lineNumber ?? lines.length + 1;

  if (headingHits.length === 0 || firstHeadingLine > 1) {
    sectionIndex += 1;
    const endLine = headingHits.length === 0 ? lines.length : firstHeadingLine - 1;
    sections.push({ id: `S${sectionIndex}`, title: 'Introduction', level: 1, lineStart: 1, lineEnd: endLine });
  }

  headingHits.forEach((hit, hitIndex) => {
    const nextHit = headingHits.at(hitIndex + 1);
    const endLine = nextHit === undefined ? lines.length : nextHit.lineNumber - 1;
    sectionIndex += 1;
    sections.push({
      id: `S${sectionIndex}`,
      title: hit.heading.title,
      level: hit.heading.level,
      lineStart: hit.lineNumber,
      lineEnd: endLine,
    });
  });

  const sourceLines = lines.map((text, index) => {
    const lineNumber = index + 1;
    const section = sections.find((candidate) => lineNumber >= candidate.lineStart && lineNumber <= candidate.lineEnd);
    return { number: lineNumber, text, sectionId: section?.id ?? sections.at(0)?.id ?? 'S1' };
  });

  return { sections, sourceLines };
}

/**
 * Normalises raw requirements text: stable line endings and whitespace, section detection, and a
 * word count that stays accurate for non-Latin scripts. Line numbers are 1-based over the
 * resulting `text` (blank lines included), which is what every `SourceRef` points into.
 */
export function normalizeRequirements(rawText: string): NormalizedDocument {
  const cleaned = cleanCharacters(rawText);
  const trimmedLines = cleaned.split('\n').map((line) => line.trimEnd());
  const collapsedLines = collapseBlankRuns(trimmedLines);
  const { sections, sourceLines } = buildSections(collapsedLines);
  const text = collapsedLines.join('\n');
  return { text, lines: sourceLines, sections, wordCount: countWords(text) };
}
