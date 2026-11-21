import { cn } from "cn"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { criticalityTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeItem } from "@/api/types"

interface GapPanelProps {
  gaps: readonly ScopeItem[]
  onSelectId: (id: string) => void
}

/** Missing information, critical gaps first and visually louder. */
export function GapPanel({ gaps, onSelectId }: GapPanelProps) {
  const sorted = [...gaps].sort(
    (left, right) =>
      Number(right.details?.gap?.criticality === "high") -
      Number(left.details?.gap?.criticality === "high"),
  )

  return (
    <>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gaps were recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((gap) => {
            const critical = gap.details?.gap?.criticality === "high"
            const linked = [gap.details?.gap?.question_id, gap.details?.gap?.assumption_id].filter(
              Boolean,
            ) as string[]
            return (
              <li
                key={gap.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3",
                  critical && "border-danger/50 bg-danger/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <IdBadge id={gap.id} onSelect={onSelectId} />
                  <Badge
                    variant={toneBadgeVariant(
                      criticalityTone(gap.details?.gap?.criticality ?? "medium"),
                    )}
                  >
                    {label(gap.details?.gap?.criticality ?? "medium")} criticality
                  </Badge>
                  <span className="font-medium">{gap.title}</span>
                </div>
                {gap.description ? <p className="text-sm">{gap.description}</p> : null}
                <IdList ids={linked} label="Raised as" onSelect={onSelectId} />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
