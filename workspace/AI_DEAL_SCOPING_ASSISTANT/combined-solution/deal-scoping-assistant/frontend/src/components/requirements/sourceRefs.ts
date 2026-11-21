import type { Segment, SourceRef } from "@/api/types"

export interface QuoteRange {
  /** The segment text the quote sits in. */
  text: string
  start: number
  end: number
}

/**
 * Source offsets are relative to the document's normalized text, so they are shifted into
 * the segment. When they are missing or do not line up, the quote is located by search.
 */
export function quoteRange(ref: SourceRef, segment: Segment | undefined): QuoteRange {
  if (!segment) return { text: ref.quote, start: 0, end: ref.quote.length }

  const text = segment.text
  const start = (ref.start ?? 0) - segment.start
  const end = (ref.end ?? 0) - segment.start
  if (start >= 0 && end > start && end <= text.length) return { text, start, end }

  const found = ref.quote ? text.indexOf(ref.quote) : -1
  if (found >= 0) return { text, start: found, end: found + ref.quote.length }
  return { text, start: 0, end: 0 }
}
