/**
 * Grounding validator: requirement-level source traceability is only trustworthy if every quote
 * really occurs in the customer text. Each quote is located by (1) exact match, (2) case- and
 * whitespace-insensitive match, (3) best token overlap with a single line above a threshold.
 * Located quotes get section + line references and `verified = true`; a 'customer-stated' item
 * that cannot be located is re-labelled 'ai-inferred' and reported as an 'ungrounded-claim'.
 */
import type { NormalizedDocument, ScopeItemDraft, SourceLine, SourceRef, ValidationIssue } from '../domain';

/** Share of the quote's distinct words that must occur in one source line to accept a fuzzy match. */
export const TOKEN_OVERLAP_THRESHOLD = 0.6;
/** Fuzzy matching on one or two words would match almost any line. */
export const MIN_TOKENS_FOR_OVERLAP = 3;

type MatchMethod = 'exact' | 'normalized' | 'token-overlap';

interface QuoteLocation {
  lineStart: number;
  lineEnd: number;
  method: MatchMethod;
}

interface IndexedLine {
  offset: number;
  line: SourceLine;
}

/** Source lines concatenated under one text transform, with the offset at which each line starts. */
interface SearchIndex {
  text: string;
  lines: IndexedLine[];
}

const CURLY_QUOTES = /[‘’“”]/g;
const EDGE_NOISE = /^[\s"'.…]+|[\s"'…]+$/g;
const NON_WORD = /[^\p{L}\p{N}]+/u;

/** Lower-case, straight quotes, single spaces - differences a model introduces when "quoting". */
export function looseNormalize(text: string): string {
  return text.toLowerCase().replace(CURLY_QUOTES, "'").replace(/\s+/g, ' ').replace(EDGE_NOISE, '');
}

function buildIndex(lines: readonly SourceLine[], transform: (text: string) => string, separator: string): SearchIndex {
  const indexed: IndexedLine[] = [];
  let text = '';
  for (const line of lines) {
    const content = transform(line.text);
    if (content === '') {
      continue;
    }
    text += text === '' ? '' : separator;
    indexed.push({ offset: text.length, line });
    text += content;
  }
  return { text, lines: indexed };
}

function lineAtOffset(index: SearchIndex, offset: number): SourceLine | undefined {
  return index.lines.findLast((entry) => entry.offset <= offset)?.line;
}

function locateInIndex(index: SearchIndex, needle: string, method: MatchMethod): QuoteLocation | undefined {
  const offset = needle === '' ? -1 : index.text.indexOf(needle);
  if (offset === -1) {
    return undefined;
  }
  const first = lineAtOffset(index, offset);
  const last = lineAtOffset(index, offset + needle.length - 1);
  return first === undefined ? undefined : { lineStart: first.number, lineEnd: (last ?? first).number, method };
}

function distinctTokens(text: string): Set<string> {
  return new Set(looseNormalize(text).split(NON_WORD).filter((word) => word !== ''));
}

function overlapRatio(quoteTokens: ReadonlySet<string>, lineTokens: ReadonlySet<string>): number {
  const shared = [...quoteTokens].filter((token) => lineTokens.has(token)).length;
  return shared / quoteTokens.size;
}

/** Best single line by token overlap; the earliest line wins ties so the result is deterministic. */
function locateByOverlap(lines: readonly SourceLine[], quote: string): QuoteLocation | undefined {
  const quoteTokens = distinctTokens(quote);
  if (quoteTokens.size < MIN_TOKENS_FOR_OVERLAP) {
    return undefined;
  }
  let best: { line: SourceLine; ratio: number } | undefined;
  for (const line of lines) {
    const ratio = overlapRatio(quoteTokens, distinctTokens(line.text));
    if (ratio >= TOKEN_OVERLAP_THRESHOLD && (best === undefined || ratio > best.ratio)) {
      best = { line, ratio };
    }
  }
  return best === undefined ? undefined : { lineStart: best.line.number, lineEnd: best.line.number, method: 'token-overlap' };
}

/** Pre-computed search structures so a long document is indexed once, not once per item. */
class QuoteLocator {
  private readonly exact: SearchIndex;
  private readonly loose: SearchIndex;
  private readonly lines: readonly SourceLine[];
  private readonly sectionTitles: ReadonlyMap<string, string>;

  constructor(document: NormalizedDocument) {
    this.lines = document.lines;
    this.exact = buildIndex(document.lines, (text) => text, '\n');
    this.loose = buildIndex(document.lines, looseNormalize, ' ');
    this.sectionTitles = new Map(document.sections.map((section) => [section.id, section.title]));
  }

  locate(quote: string): QuoteLocation | undefined {
    return (
      locateInIndex(this.exact, quote.trim(), 'exact') ??
      locateInIndex(this.loose, looseNormalize(quote), 'normalized') ??
      locateByOverlap(this.lines, quote)
    );
  }

  /** Verified source reference; a fuzzy match adopts the real line so the stored quote is verbatim. */
  toSourceRef(quote: string, location: QuoteLocation): SourceRef {
    const line = this.lines.find((candidate) => candidate.number === location.lineStart);
    const sectionId = line?.sectionId ?? '';
    return {
      sectionId,
      sectionTitle: this.sectionTitles.get(sectionId) ?? '',
      lineStart: location.lineStart,
      lineEnd: location.lineEnd,
      quote: location.method === 'token-overlap' && line !== undefined ? line.text.trim() : quote.trim(),
      verified: true,
    };
  }
}

interface GroundedDraft {
  item: ScopeItemDraft;
  issues: ValidationIssue[];
}

function unverifiedSource(source: SourceRef | null): SourceRef | null {
  return source === null ? null : { ...source, sectionId: '', sectionTitle: '', lineStart: 0, lineEnd: 0, verified: false };
}

/** Downgrades an unverifiable 'customer-stated' claim; other provenances only lose `verified`. */
function rejectGrounding(draft: ScopeItemDraft, reason: string): GroundedDraft {
  const source = unverifiedSource(draft.source);
  if (draft.provenance !== 'customer-stated') {
    const issues: ValidationIssue[] =
      source === null || source.quote.trim() === ''
        ? []
        : [{ severity: 'info', code: 'unverified-quote', message: `${draft.id}: the cited text ${reason}; the source reference was cleared.`, refs: [draft.id] }];
    return { item: { ...draft, source }, issues };
  }
  return {
    item: { ...draft, provenance: 'ai-inferred', source },
    issues: [
      {
        severity: 'warning',
        code: 'ungrounded-claim',
        message: `${draft.id} was labelled customer-stated but its quote ${reason}; it was re-labelled AI-inferred and needs reviewer confirmation.`,
        refs: [draft.id],
      },
    ],
  };
}

function groundDraft(draft: ScopeItemDraft, locator: QuoteLocator): GroundedDraft {
  const quote = draft.source?.quote ?? '';
  if (quote.trim() === '') {
    return rejectGrounding(draft, 'is missing');
  }
  const location = locator.locate(quote);
  if (location === undefined) {
    return rejectGrounding(draft, 'could not be found in the customer text');
  }
  const issues: ValidationIssue[] =
    location.method === 'token-overlap'
      ? [{ severity: 'info', code: 'quote-realigned', message: `${draft.id}: the quote was paraphrased; it was replaced with the matching source line ${location.lineStart}.`, refs: [draft.id] }]
      : [];
  return { item: { ...draft, source: locator.toSourceRef(quote, location) }, issues };
}

/** Verifies every quote against the source, fills section/line refs, downgrades unverifiable claims. */
export function groundScopeItems(
  drafts: ScopeItemDraft[],
  document: NormalizedDocument,
): { items: ScopeItemDraft[]; issues: ValidationIssue[] } {
  const locator = new QuoteLocator(document);
  const grounded = drafts.map((draft) => groundDraft(draft, locator));
  return { items: grounded.map((entry) => entry.item), issues: grounded.flatMap((entry) => entry.issues) };
}
