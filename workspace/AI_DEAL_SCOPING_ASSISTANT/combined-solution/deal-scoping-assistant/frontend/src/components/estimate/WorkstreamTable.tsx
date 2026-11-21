import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge"
import { IdList } from "@/components/shared/IdList"
import { TraceTable } from "@/components/shared/TraceTable"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import type { WorkstreamEstimate } from "@/api/types"

interface WorkstreamTableProps {
  workstreams: readonly WorkstreamEstimate[]
  onSelectId?: (id: string) => void
}

/** One card per workstream so the range, the confidence and the arithmetic sit together. */
export function WorkstreamTable({ workstreams, onSelectId }: WorkstreamTableProps) {
  return (
    <ul className="flex flex-col gap-3">
      {workstreams.map((workstream) => (
        <li key={workstream.workstream_id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{workstream.name}</span>
            <Badge variant="outline">Complexity: {label(workstream.complexity)}</Badge>
            <ConfidenceBadge confidence={workstream.confidence} />
            {workstream.overhead ? <Badge variant="ghost">Overhead</Badge> : null}
            <span className="ml-auto text-sm tabular-nums">
              {workstream.effort_low}–{workstream.effort_high} person-weeks
            </span>
          </div>
          {workstream.roles.length > 0 ? (
            <p className="text-xs text-muted-foreground">Roles: {workstream.roles.join(", ")}</p>
          ) : null}
          {workstream.blocked ? (
            <p className="text-sm text-destructive">Not calculable: {workstream.blocked_reason}</p>
          ) : null}
          {workstream.limitations.length > 0 ? (
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
              {workstream.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          ) : null}
          <IdList
            ids={workstream.req_ids}
            label={`${workstream.name} requirements`}
            onSelect={onSelectId}
          />
          <TraceTable entries={workstream.trace} />
        </li>
      ))}
    </ul>
  )
}
