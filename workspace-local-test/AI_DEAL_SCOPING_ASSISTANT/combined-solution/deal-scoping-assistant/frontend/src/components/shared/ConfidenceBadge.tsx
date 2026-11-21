import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { confidenceTone, toneBadgeVariant } from "@/lib/status"
import type { Confidence } from "@/components/shared/types"

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <Badge variant={toneBadgeVariant(confidenceTone(confidence))}>
      {label(confidence)} confidence
    </Badge>
  )
}
