/**
 * Renders a `NormalizedDocument` with section headings and line numbers - the "Normalized content
 * preview" (spec "Recommended Application Sections 1") and, with a highlight range, the Source
 * panel that a source reference opens (spec Core User Journey step 5: "review ... source
 * references"). Quoted customer wording is emphasised with `<mark>` inside the highlighted range.
 */
import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { NormalizedDocument, SourceLine } from '../../domain';
import { EmptyState } from '../common';

export interface NormalizedTextViewProps {
  document: NormalizedDocument;
  highlightStart?: number;
  highlightEnd?: number;
  /** Verbatim customer wording to emphasise inside the highlighted lines. */
  quote?: string;
}

const SECTION_HEADING_TAGS: readonly ('h4' | 'h5' | 'h6')[] = ['h4', 'h5', 'h6'];

function sectionHeadingTag(level: number): 'h4' | 'h5' | 'h6' {
  const index = Math.min(Math.max(level - 1, 0), SECTION_HEADING_TAGS.length - 1);
  return SECTION_HEADING_TAGS.at(index) ?? 'h6';
}

/** Splits `text` around the first occurrence of `quote` (case-insensitive) so it can be wrapped in `<mark>`. */
function emphasiseQuote(text: string, quote: string | undefined): ReactNode {
  const trimmedQuote = quote?.trim() ?? '';
  if (trimmedQuote.length === 0) {
    return text;
  }
  const matchIndex = text.toLowerCase().indexOf(trimmedQuote.toLowerCase());
  if (matchIndex === -1) {
    return text;
  }
  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + trimmedQuote.length);
  const after = text.slice(matchIndex + trimmedQuote.length);
  return (
    <>
      {before}
      <mark className="normalized-text-quote">{match}</mark>
      {after}
    </>
  );
}

function headingBeforeLine(document: NormalizedDocument, line: SourceLine): ReactElement | null {
  const section = document.sections.find((candidate) => candidate.lineStart === line.number);
  if (section === undefined) {
    return null;
  }
  const HeadingTag = sectionHeadingTag(section.level);
  return <HeadingTag className="normalized-text-heading">{section.title}</HeadingTag>;
}

export function NormalizedTextView({ document, highlightStart, highlightEnd, quote }: NormalizedTextViewProps): ReactElement {
  const firstHighlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightStart !== undefined) {
      firstHighlightedRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [highlightStart, highlightEnd]);

  if (document.lines.length === 0) {
    return <EmptyState title="Nothing to preview yet" message="Paste or upload requirements text to see the normalized content." />;
  }

  return (
    <div className="normalized-text-view" role="group" aria-label="Normalized requirements text">
      {document.lines.map((line) => {
        const isHighlighted = highlightStart !== undefined && highlightEnd !== undefined && line.number >= highlightStart && line.number <= highlightEnd;
        const isFirstHighlighted = isHighlighted && line.number === highlightStart;
        return (
          <div key={line.number}>
            {headingBeforeLine(document, line)}
            <div
              ref={isFirstHighlighted ? firstHighlightedRef : undefined}
              className={`normalized-text-line${isHighlighted ? ' normalized-text-line-highlighted' : ''}`}
            >
              <span className="normalized-text-line-number">{line.number}</span>
              <span className="normalized-text-line-content">{isHighlighted ? emphasiseQuote(line.text, quote) : line.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
