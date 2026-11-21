import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { Origin } from "@/components/shared/types"

export function OriginBadge({ origin }: { origin: Origin }) {
  return (
    <Badge variant={toneBadgeVariant(statusTone(origin))} aria-label={`Origin: ${label(origin)}`}>
      {label(origin)}
    </Badge>
  )
}
