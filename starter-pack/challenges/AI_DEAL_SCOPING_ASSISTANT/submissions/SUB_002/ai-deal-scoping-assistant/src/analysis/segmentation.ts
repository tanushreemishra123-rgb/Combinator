/**
 * Stage 1 of the heuristic engine: split the normalised customer text into candidate statements
 * (bullets, numbered items, sentences and semicolon clauses). Every statement keeps its verbatim
 * wording, line number and section so extracted items can always be traced back to the source.
 */
import type { NormalizedDocument, SourceSection } from '../domain';
import { normalizeForMatch } from './textMatch';

export interface Statement {
  /** Verbatim wording (a substring of the source line) - used as the quote of extracted items. */
  text: string;
  /** Normalised form used for cue matching. */
  normalized: string;
  lineNumber: number;
  sectionId: string;
  sectionTitle: string;
  /** The customer's own requirement label prefix ("BR" of "BR1.", "NFR" of "NFR-04:"), else ''. */
  label: string;
}

/** Upper bound on analysed statements so a very long RFP stays responsive in the browser. */
export const MAX_STATEMENTS = 400;
/** Anything shorter carries no analysable meaning (stray labels, page numbers). */
export const MIN_STATEMENT_CHARACTERS = 4;
/** Quotes longer than this are cut at a word boundary; the prefix is still verbatim source text. */
export const MAX_STATEMENT_CHARACTERS = 320;

const LIST_MARKER = /^\s*(?:[-*+>•▪◦·]|\d{1,3}[.)]|[a-zA-Z][.)]|\(\d{1,3}\)|\[[ xX]?\])\s+/u;
/** A customer requirement label opening a line: "BR1.", "FR-10:", "NFR_2)", "**REQ 12** -". */
const REQUIREMENT_LABEL = /^\s*\*{0,2}([A-Z]{1,5})[-_ ]?\d{1,3}[.\d]{0,6}\*{0,2}\s?[:.)\]-]\*{0,2}\s+/;
/** A Markdown ATX heading allows at most three leading spaces and one to six '#' markers. */
const MAX_HEADING_LEADING_SPACES = 3;
const MAX_HEADING_MARKER_LEVEL = 6;
const HAS_LETTER = /\p{L}/u;
const LATIN_TERMINATORS: readonly string[] = ['.', '?', '!', ';'];
const CJK_TERMINATORS: readonly string[] = ['。', '？', '！', '；'];
const ABBREVIATIONS: readonly string[] = ['e.g.', 'i.e.', 'etc.', 'vs.', 'approx.', 'inc.', 'ltd.', 'incl.'];

function endsWithAbbreviation(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return ABBREVIATIONS.some((abbreviation) => lower.endsWith(abbreviation));
}

/** A Latin terminator only ends a sentence before whitespace, so "99.9%" and "v2.1" stay intact. */
function isSentenceEnd(characters: readonly string[], index: number, sentence: string): boolean {
  const character = characters.at(index) ?? '';
  if (CJK_TERMINATORS.includes(character)) {
    return true;
  }
  if (!LATIN_TERMINATORS.includes(character)) {
    return false;
  }
  const next = characters.at(index + 1);
  return next !== undefined && next.trim() === '' && !endsWithAbbreviation(sentence);
}

/** Splits one line into sentences and semicolon clauses without altering the wording. */
export function splitSentences(line: string): string[] {
  const characters = Array.from(line);
  const sentences: string[] = [];
  let current = '';
  for (const [index, character] of characters.entries()) {
    current += character;
    if (isSentenceEnd(characters, index, current)) {
      sentences.push(current);
      current = '';
    }
  }
  sentences.push(current);
  return sentences.map(trimClause).filter((sentence) => sentence !== '');
}

/** A clause separator is not part of the statement; the remaining text is still verbatim. */
function trimClause(sentence: string): string {
  return sentence.trim().replace(/[;\uFF1B]$/u, '').trim();
}

function truncateAtWord(text: string): string {
  if (text.length <= MAX_STATEMENT_CHARACTERS) {
    return text;
  }
  const head = text.slice(0, MAX_STATEMENT_CHARACTERS);
  const lastSpace = head.lastIndexOf(' ');
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).trim();
}

/**
 * True for a Markdown ATX heading line ("# Title", "   ### Sub"). Checked with plain string
 * scanning (`trimStart`, a bounded counting loop) instead of a regex, so there is no risk of a
 * pathological match time on adversarial input - `startsWith`/`.test()` on untrusted text is
 * otherwise safe here, but chaining two bounded quantifiers next to each other is not worth the
 * regex-engine cost when a linear scan is this simple.
 */
function isMarkdownHeadingLine(text: string): boolean {
  const leadingSpaces = text.length - text.trimStart().length;
  if (leadingSpaces > MAX_HEADING_LEADING_SPACES) {
    return false;
  }
  const afterIndent = text.slice(leadingSpaces);
  let markerLevel = 0;
  while (markerLevel < afterIndent.length && afterIndent.charAt(markerLevel) === '#') {
    markerLevel += 1;
  }
  if (markerLevel === 0 || markerLevel > MAX_HEADING_MARKER_LEVEL) {
    return false;
  }
  const next = afterIndent.charAt(markerLevel);
  return next !== '' && next.trim() === '';
}

function isHeadingLine(text: string, lineNumber: number, section: SourceSection | undefined): boolean {
  if (isMarkdownHeadingLine(text)) {
    return true;
  }
  return section !== undefined && section.lineStart === lineNumber && normalizeForMatch(text) === normalizeForMatch(section.title);
}

function isAnalysable(text: string): boolean {
  return text.length >= MIN_STATEMENT_CHARACTERS && HAS_LETTER.test(text);
}

interface LineBody {
  label: string;
  body: string;
}

/**
 * Removes the list marker and any requirement label from a line. The label is kept separately: it
 * is the customer's own classification of the statement and would otherwise become a bogus
 * one-word statement ("BR1.") when the line is split into sentences.
 */
export function splitLineLabel(lineText: string): LineBody {
  const unmarked = lineText.replace(LIST_MARKER, '');
  const match = REQUIREMENT_LABEL.exec(unmarked);
  if (match === null) {
    return { label: '', body: unmarked };
  }
  return { label: match.at(1) ?? '', body: unmarked.slice((match.at(0) ?? '').length) };
}

/** Candidate statements in document order, capped at {@link MAX_STATEMENTS}. */
export function segmentDocument(document: NormalizedDocument): Statement[] {
  const sections = new Map(document.sections.map((section) => [section.id, section]));
  const statements: Statement[] = [];
  for (const line of document.lines) {
    const section = sections.get(line.sectionId);
    if (isHeadingLine(line.text, line.number, section)) {
      continue;
    }
    const { label, body } = splitLineLabel(line.text);
    for (const sentence of splitSentences(body)) {
      const text = truncateAtWord(sentence);
      if (isAnalysable(text)) {
        statements.push({
          text,
          normalized: normalizeForMatch(text),
          lineNumber: line.number,
          sectionId: line.sectionId,
          sectionTitle: section?.title ?? '',
          label,
        });
      }
    }
    if (statements.length >= MAX_STATEMENTS) {
      break;
    }
  }
  return statements.slice(0, MAX_STATEMENTS);
}

/** Letters and digits only - two statements with the same key are treated as duplicates. */
export function statementKey(statement: Statement): string {
  return statement.normalized.replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Removes repeated statements (RFPs often restate a requirement in a summary table). */
export function dedupeStatements(statements: readonly Statement[]): Statement[] {
  const seen = new Set<string>();
  return statements.filter((statement) => {
    const key = statementKey(statement);
    if (key === '' || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
