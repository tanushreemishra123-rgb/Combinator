import { GroundedItem } from "@/components/prd/GroundedItem"
import type { FrameworkRecommendation } from "@/api/types"

interface FrameworkListProps {
  frameworks: readonly FrameworkRecommendation[]
  onSelectId?: (id: string) => void
}

/** Named frameworks with a reason tied to this solution, never a list of popular tools. */
export function FrameworkList({ frameworks, onSelectId }: FrameworkListProps) {
  if (frameworks.length === 0) {
    return <p className="text-sm text-muted-foreground">No framework was recommended.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {frameworks.map((framework) => (
        <GroundedItem
          key={framework.name}
          title={framework.name}
          text={framework.purpose}
          element={framework}
          onSelectId={onSelectId}
        >
          <p className="text-sm text-muted-foreground">Why here: {framework.rationale}</p>
          {framework.alternatives_considered.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Also considered: {framework.alternatives_considered.join(", ")}
            </p>
          ) : null}
        </GroundedItem>
      ))}
    </ul>
  )
}
