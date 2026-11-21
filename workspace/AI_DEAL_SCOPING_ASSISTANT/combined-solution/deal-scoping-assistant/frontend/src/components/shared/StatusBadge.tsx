import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { Status } from "@/components/shared/types"

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge
      variant={toneBadgeVariant(statusTone(status))}
      className={className}
      aria-label={`Status: ${label(status)}`}
    >
      {label(status)}
    </Badge>
  )
}
