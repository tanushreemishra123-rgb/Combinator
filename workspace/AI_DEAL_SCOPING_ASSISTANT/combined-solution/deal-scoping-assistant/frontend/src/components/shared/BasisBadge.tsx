import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { Basis } from "@/components/shared/types"

export function BasisBadge({ basis }: { basis: Basis }) {
  return (
    <Badge variant={toneBadgeVariant(statusTone(basis))} aria-label={`Basis: ${label(basis)}`}>
      {label(basis)}
    </Badge>
  )
}
