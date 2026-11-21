import { Badge } from "@/components/ui/badge"
import type { PhaseEstimate } from "@/api/types"

/** Phases in delivery order, each with the milestones that close it. */
export function PhaseTimeline({ phases }: { phases: readonly PhaseEstimate[] }) {
  if (phases.length === 0) {
    return <p className="text-sm text-muted-foreground">No delivery phases yet.</p>
  }
  return (
    <ol className="flex flex-col gap-3">
      {phases.map((phase, index) => (
        <li key={phase.name} className="flex gap-3 rounded-lg border p-3">
          <span className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{phase.name}</span>
              <Badge variant="outline" className="tabular-nums">
                {phase.weeks_low}–{phase.weeks_high} weeks
              </Badge>
            </div>
            {phase.milestones.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                {phase.milestones.map((milestone) => (
                  <li key={milestone.name}>
                    {milestone.name} — week {milestone.week_low}
                    {milestone.week_high !== milestone.week_low ? `–${milestone.week_high}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
