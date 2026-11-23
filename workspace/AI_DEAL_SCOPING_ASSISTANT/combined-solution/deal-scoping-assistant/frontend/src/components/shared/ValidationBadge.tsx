import { TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ValidationBadgeProps {
  reason?: string
}

// Flags an element whose basis is assumed or recommended, so a human checks it before the hand-off.
export function ValidationBadge({ reason }: ValidationBadgeProps) {
  const badge = (
    <Badge variant="warning">
      <TriangleAlertIcon />
      Needs validation
    </Badge>
  )
  if (!reason) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Needs validation: ${reason}`}>
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
