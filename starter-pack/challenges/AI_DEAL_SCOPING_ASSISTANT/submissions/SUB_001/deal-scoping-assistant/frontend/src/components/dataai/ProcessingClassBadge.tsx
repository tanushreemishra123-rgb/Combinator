import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ProcessingClass } from "@/api/types"

/** Tells AI work apart from deterministic rules and decisions that must stay with a human. */
export function ProcessingClassBadge({ processing }: { processing: ProcessingClass }) {
  return (
    <Badge
      variant={toneBadgeVariant(statusTone(processing))}
      aria-label={`Processing: ${label(processing)}`}
    >
      {label(processing)}
    </Badge>
  )
}
