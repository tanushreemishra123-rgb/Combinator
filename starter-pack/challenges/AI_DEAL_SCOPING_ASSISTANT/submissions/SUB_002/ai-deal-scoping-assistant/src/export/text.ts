/**
 * Small, dependency-light formatting helpers shared by every package section and exporter.
 * Centralising them here is what keeps the rendered package free of `undefined`, `null`, `NaN`
 * and raw JSON: every optional domain value is resolved to explicit, professional prose before it
 * reaches a `DocBlock`, and every "missing data" case renders the same clearly labelled callout
 * instead of being silently dropped (spec section 6, "Integrated Scoping Package").
 */
import type { CloudPlatform, ContentLabel, DocBlock, GenerationMeta, MoneyRange, NumericRange, SourceRef, TracedStatement } from '../domain';
import { formatMoney } from '../estimation';

const WHOLE_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Whole number with thousands separators. Display only - never used by a calculation. */
export function formatWhole(value: number): string {
  return WHOLE_NUMBER.format(Number.isFinite(value) ? Math.round(value) : 0);
}

const ISO_DATE_LENGTH = 10;
const ISO_MINUTES_END = 16;

/**
 * '2026-09-19T08:30:12.345Z' -> '2026-09-19 08:30 UTC'. Sliced rather than locale-formatted so an
 * export reads the same on every machine; anything that is not an ISO timestamp is shown as is.
 */
export function formatTimestamp(iso: string): string {
  if (iso.length < ISO_MINUTES_END || iso.charAt(ISO_DATE_LENGTH) !== 'T' || !iso.endsWith('Z')) {
    return iso;
  }
  return `${iso.slice(0, ISO_DATE_LENGTH)} ${iso.slice(ISO_DATE_LENGTH + 1, ISO_MINUTES_END)} UTC`;
}

const PLATFORM_LABELS: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'Amazon Web Services (AWS)'],
  ['azure', 'Microsoft Azure'],
  ['gcp', 'Google Cloud Platform (GCP)'],
]);

export function platformDisplayName(platform: CloudPlatform | null): string {
  return platform === null ? 'Not yet selected' : (PLATFORM_LABELS.get(platform) ?? platform.toUpperCase());
}

const CONTENT_LABEL_TEXT: ReadonlyMap<ContentLabel, string> = new Map([
  ['customer-requested', 'Customer-requested'],
  ['ai-interpretation', 'AI interpretation'],
  ['recommended-enhancement', 'AI recommendation'],
  ['assumption-to-confirm', 'Assumption to confirm'],
  ['out-of-scope', 'Out of scope'],
]);

/** Display text for a `ContentLabel`; a recommended enhancement is always marked 'AI recommendation'. */
export function contentLabelText(label: ContentLabel): string {
  return CONTENT_LABEL_TEXT.get(label) ?? 'AI interpretation';
}

/** Joins a list for prose, or an explicit fallback when it is empty - a table cell is never blank. */
export function joinOrFallback(items: readonly string[], fallback: string): string {
  return items.length === 0 ? fallback : items.join(', ');
}

const TERMINAL_PUNCTUATION = new Set(['.', '!', '?']);

/** Whether `text` already reads as a complete sentence, so it needs no comma spliced after it. */
function endsWithTerminalPunctuation(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && TERMINAL_PUNCTUATION.has(trimmed.charAt(trimmed.length - 1));
}

/**
 * Joins full-sentence items for prose without the ', ' artifact that turns 'release.' followed by
 * 'A globally...' into 'release., A globally...'. Each item is followed by a single space when it
 * already ends in terminal punctuation, and by '; ' otherwise (it is a fragment, not a sentence).
 */
export function joinSentences(items: readonly string[], fallback: string): string {
  if (items.length === 0) {
    return fallback;
  }
  return items.reduce((joined, item, index) => {
    if (index === 0) {
      return item;
    }
    const previous = items.at(index - 1) ?? '';
    const separator = endsWithTerminalPunctuation(previous) ? ' ' : '; ';
    return `${joined}${separator}${item}`;
  }, '');
}

export function refsCell(refs: readonly string[]): string {
  return joinOrFallback(refs, 'None cited');
}

/** 'Business goals - lines 2-3', or an explicit statement when the item has no verified source passage. */
export function sourceReferenceText(source: SourceRef | null): string {
  if (source === null || source.sectionTitle.trim().length === 0) {
    return 'Not sourced from a specific customer passage';
  }
  const verifiedNote = source.verified ? '' : ' (source text not verified)';
  return `${source.sectionTitle} - lines ${source.lineStart}-${source.lineEnd}${verifiedNote}`;
}

/** One statement plus its refs and content-label tag: '<text> (Refs: FR_01, FR_02; AI interpretation)'. */
export function statementLine(statement: TracedStatement): string {
  return `${statement.text} (Refs: ${refsCell(statement.refs)}; ${contentLabelText(statement.label)})`;
}

export function moneyRangeText(range: MoneyRange): string {
  return `${formatMoney(range.low, range.currency)} to ${formatMoney(range.high, range.currency)} (likely ${formatMoney(range.likely, range.currency)})`;
}

export function moneyRangeOrBlocked(range: MoneyRange | null, blockedText: string): string {
  return range === null ? blockedText : moneyRangeText(range);
}

export function daysRangeText(range: NumericRange): string {
  return `${formatWhole(range.low)} to ${formatWhole(range.high)} person-days (likely ${formatWhole(range.likely)})`;
}

export function weeksRangeText(range: NumericRange): string {
  return `${formatWhole(range.low)} to ${formatWhole(range.high)} weeks (likely ${formatWhole(range.likely)})`;
}

export type CalloutTone = Extract<DocBlock, { type: 'callout' }>['tone'];

/** GitHub-style heading anchor: lowercase, spaces to hyphens, punctuation stripped. Shared by the
 * Markdown table of contents and the HTML export's in-page navigation so both link to the same ids. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** A clear "not generated" callout instead of silently dropping a section or sub-part. */
export function notGeneratedCallout(detail: string): DocBlock {
  return { type: 'callout', tone: 'warning', title: 'Not generated yet', text: `Not generated yet - ${detail}.` };
}

export function infoCallout(title: string, text: string): DocBlock {
  return { type: 'callout', tone: 'info', title, text };
}

export function headingBlock(level: 3 | 4, text: string): DocBlock {
  return { type: 'heading', level, text };
}

export function listBlock(items: readonly string[]): DocBlock {
  return { type: 'list', items: [...items] };
}

/** A table, or a plain-language paragraph when there are no rows - an empty table reads like a bug. */
export function tableOrParagraph(columns: readonly string[], rows: readonly (readonly string[])[], emptyMessage: string): DocBlock {
  if (rows.length === 0) {
    return { type: 'paragraph', text: emptyMessage };
  }
  return { type: 'table', columns: [...columns], rows: rows.map((row) => [...row]) };
}

/** Small "how this section was produced" block shown under every AI-generated section. */
export function provenanceBlock(meta: GenerationMeta | null): DocBlock | null {
  if (meta === null) {
    return null;
  }
  return {
    type: 'keyValues',
    pairs: [
      { key: 'Generated by', value: meta.providerLabel },
      { key: 'Mode', value: meta.mode === 'live' ? 'Live AI provider' : 'Mock AI (deterministic, offline)' },
      { key: 'Fallback used', value: meta.usedFallback ? 'Yes' : 'No' },
      { key: 'Generated at', value: formatTimestamp(meta.generatedAt) },
    ],
  };
}

/** Splits free text on blank lines into one paragraph block per paragraph. */
export function paragraphsFromText(text: string): DocBlock[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part): DocBlock => ({ type: 'paragraph', text: part }));
}
