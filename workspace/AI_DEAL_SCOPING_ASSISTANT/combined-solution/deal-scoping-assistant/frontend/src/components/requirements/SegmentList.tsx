import { cn } from "cn"
import { IdBadge } from "@/components/shared/IdBadge"
import type { Segment } from "@/api/types"

/** The normalized text as the assistant sees it: ordered segments with their addressable ids. */
export function SegmentList({ segments }: { segments: readonly Segment[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {segments.map((segment) => (
        <li key={segment.segment_id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <IdBadge id={segment.segment_id} />
            {segment.page !== null && segment.page !== undefined ? (
              <span className="text-xs text-muted-foreground">Page {segment.page}</span>
            ) : null}
          </div>
          <p
            className={cn(
              "text-sm whitespace-pre-wrap",
              segment.kind === "heading"
                ? "font-heading font-medium tracking-tight"
                : "text-muted-foreground",
            )}
          >
            {segment.text}
          </p>
        </li>
      ))}
    </ol>
  )
}
