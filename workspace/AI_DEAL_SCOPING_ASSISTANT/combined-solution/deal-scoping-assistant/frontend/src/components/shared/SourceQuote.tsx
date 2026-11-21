import { cn } from "cn"

interface SourceQuoteProps {
  /** Full text of the source segment. */
  text: string
  /** Character offsets of the quoted range, relative to `text`. */
  start: number
  end: number
  className?: string
}

// Shows the customer's own words with the cited range highlighted, not just a citation id.
export function SourceQuote({ text, start, end, className }: SourceQuoteProps) {
  const from = Math.max(0, Math.min(start, text.length))
  const to = Math.max(from, Math.min(end, text.length))
  const quoted = text.slice(from, to)

  return (
    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>
      {text.slice(0, from)}
      {quoted ? <mark>{quoted}</mark> : null}
      {text.slice(to)}
    </p>
  )
}
