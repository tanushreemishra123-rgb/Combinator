import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { elementLabel, isStructuredId } from "@/lib/labels"

interface IdBadgeProps {
  id: string
  onSelect?: (id: string) => void
  className?: string
}

// Monospace keeps FR_01 / ARC_12 style ids scannable in dense traceability lists;
// section names are shown as plain words instead.
export function IdBadge({ id, onSelect, className }: IdBadgeProps) {
  const text = elementLabel(id)
  const classes = cn(isStructuredId(id) && "font-mono", className)
  if (!onSelect) {
    return (
      <Badge variant="outline" className={classes}>
        {text}
      </Badge>
    )
  }
  return (
    <Badge
      asChild
      variant="outline"
      // The badge's own hover styles only apply to links, so buttons get their own.
      className={cn(
        classes,
        "cursor-pointer hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
      )}
    >
      <button type="button" onClick={() => onSelect(id)} aria-label={`Open ${text}`}>
        {text}
      </button>
    </Badge>
  )
}
