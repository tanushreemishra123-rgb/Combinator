import { IdBadge } from "@/components/shared/IdBadge"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import type { ValidationItem } from "@/api/types"

interface ValidationItemsProps {
  items: readonly ValidationItem[]
  onSelectId?: (id: string) => void
}

/** Assumptions and generated elements a person must sign off before the package goes out. */
export function ValidationItems({ items, onSelectId }: ValidationItemsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing is waiting for human validation.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={`${item.kind}-${item.id}`}
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
        >
          <IdBadge id={item.id} onSelect={onSelectId} />
          <Badge variant="outline">{label(item.kind)}</Badge>
          {item.artifact ? <Badge variant="ghost">{label(item.artifact)}</Badge> : null}
          <span className="text-sm text-muted-foreground">{item.reason}</span>
        </li>
      ))}
    </ul>
  )
}
