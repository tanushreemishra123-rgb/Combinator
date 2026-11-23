import { BadgeCheckIcon, CircleHelpIcon } from "lucide-react"
import { useDocument } from "@/api/hooks/documents"
import { quoteRange } from "@/components/requirements/sourceRefs"
import { IdBadge } from "@/components/shared/IdBadge"
import { SourceQuote } from "@/components/shared/SourceQuote"
import { Badge } from "@/components/ui/badge"
import type { SourceRef } from "@/api/types"

interface SourceRefCardProps {
  sessionId: string
  sourceRef: SourceRef
}

/** The customer's own words with the cited range highlighted, plus whether it was verified. */
export function SourceRefCard({ sessionId, sourceRef }: SourceRefCardProps) {
  const document = useDocument(sessionId, sourceRef.document_id)
  const segment = document.data?.segments?.find(
    (candidate) => candidate.segment_id === sourceRef.segment_id,
  )
  const range = quoteRange(sourceRef, segment)

  return (
    <figure className="flex flex-col gap-2 rounded-lg border p-3">
      <figcaption className="flex flex-wrap items-center gap-2">
        <IdBadge id={sourceRef.segment_id} />
        <span className="text-xs text-muted-foreground">
          {document.data?.name ?? "Source document"}
        </span>
        {sourceRef.verified ? (
          <Badge variant="secondary" aria-label="Quote verified against the source text">
            <BadgeCheckIcon />
            Verified quote
          </Badge>
        ) : (
          <Badge variant="destructive" aria-label="Quote not verified against the source text">
            <CircleHelpIcon />
            Unverified quote
          </Badge>
        )}
      </figcaption>
      <SourceQuote text={range.text} start={range.start} end={range.end} />
    </figure>
  )
}
