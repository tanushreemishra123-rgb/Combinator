import { GroundedItem } from "@/components/prd/GroundedItem"
import { IdBadge } from "@/components/shared/IdBadge"
import type { RecommendedEnhancement } from "@/api/types"

interface EnhancementSectionProps {
  enhancements: readonly RecommendedEnhancement[]
  onSelectId?: (id: string) => void
}

/** Ideas beyond what the customer asked for; labelled so they never look requested. */
export function EnhancementSection({ enhancements, onSelectId }: EnhancementSectionProps) {
  if (enhancements.length === 0) return null
  return (
    <ul className="flex flex-col gap-2">
      {enhancements.map((enhancement) => (
        <GroundedItem
          key={enhancement.id}
          title={<IdBadge id={enhancement.id} />}
          text={enhancement.description}
          element={enhancement}
          onSelectId={onSelectId}
        >
          <p className="text-sm text-muted-foreground">Why: {enhancement.rationale}</p>
          {enhancement.related_req_ids.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Builds on {enhancement.related_req_ids.join(", ")}
            </p>
          ) : null}
        </GroundedItem>
      ))}
    </ul>
  )
}
