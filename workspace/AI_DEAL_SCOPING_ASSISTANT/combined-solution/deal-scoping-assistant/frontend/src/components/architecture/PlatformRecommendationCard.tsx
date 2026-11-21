import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdList } from "@/components/shared/IdList"
import { SectionCard } from "@/components/shared/SectionCard"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import type { PlatformRecommendationContent } from "@/api/types"

interface PlatformRecommendationCardProps {
  recommendation: PlatformRecommendationContent
  onSelectId?: (id: string) => void
}

/** Why the assistant picked this platform, and why it passed on the others. */
export function PlatformRecommendationCard({
  recommendation,
  onSelectId,
}: PlatformRecommendationCardProps) {
  return (
    <SectionCard
      title="Platform recommendation"
      description="An AI recommendation, grounded in the requirements below."
      actions={<Badge>{label(recommendation.recommended)}</Badge>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <BasisBadge basis={recommendation.basis} />
        </div>
        <p className="text-sm leading-relaxed">{recommendation.rationale}</p>
        {recommendation.alternatives.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Considered and not chosen</h3>
            <ul className="flex flex-col gap-2">
              {recommendation.alternatives.map((alternative) => (
                <li
                  key={alternative.platform}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <Badge variant="outline" className="w-fit">
                    {label(alternative.platform)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{alternative.why_not}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <IdList
          ids={recommendation.req_ids}
          label="Requirements behind the recommendation"
          onSelect={onSelectId}
        />
      </div>
    </SectionCard>
  )
}
