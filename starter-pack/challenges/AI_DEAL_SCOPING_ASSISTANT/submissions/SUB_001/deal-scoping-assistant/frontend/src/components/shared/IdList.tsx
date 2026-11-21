import { useState } from "react"
import { cn } from "cn"
import { IdBadge } from "@/components/shared/IdBadge"
import { Badge } from "@/components/ui/badge"

const DEFAULT_LIMIT = 12

interface IdListProps {
  ids: readonly string[]
  label?: string
  onSelect?: (id: string) => void
  className?: string
}

/** Long id lists are capped so a card stays readable; the rest is one click away. */
export function IdList({ ids, label, onSelect, className }: IdListProps) {
  const [expanded, setExpanded] = useState(false)
  if (ids.length === 0) return null

  const hidden = expanded ? 0 : Math.max(0, ids.length - DEFAULT_LIMIT)
  const shown = hidden > 0 ? ids.slice(0, DEFAULT_LIMIT) : ids

  return (
    <ul aria-label={label ?? "Related ids"} className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((id) => (
        <li key={id}>
          <IdBadge id={id} onSelect={onSelect} />
        </li>
      ))}
      {hidden > 0 ? (
        <li>
          <Badge asChild variant="ghost" className="cursor-pointer">
            <button type="button" onClick={() => setExpanded(true)}>
              +{hidden} more
            </button>
          </Badge>
        </li>
      ) : null}
    </ul>
  )
}
