import { GroundedItem } from "@/components/prd/GroundedItem"
import type { OutOfScopeItem } from "@/api/types"

interface OutOfScopeSectionProps {
  items: readonly OutOfScopeItem[]
  onSelectId?: (id: string) => void
  title?: string
}

export function OutOfScopeSection({
  items,
  onSelectId,
  title = "Out of scope",
}: OutOfScopeSectionProps) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <GroundedItem
            key={`${item.text}-${index}`}
            text={item.text}
            element={item}
            onSelectId={onSelectId}
          >
            <p className="text-sm text-muted-foreground">Why: {item.reason}</p>
          </GroundedItem>
        ))}
      </ul>
    </section>
  )
}
