import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { priorityTone, toneBadgeVariant } from "@/lib/status"
import type { Priority } from "@/components/shared/types"

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant={toneBadgeVariant(priorityTone(priority))}
      aria-label={`Priority: ${label(priority)}`}
    >
      {label(priority)}
    </Badge>
  )
}
