import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { label } from "@/lib/labels"
import type { HistoricalProject, HistoricalProjects } from "@/api/types"

const columns: readonly DataTableColumn<HistoricalProject>[] = [
  { id: "title", header: "Project", cell: (project) => project.title },
  { id: "type", header: "Type", cell: (project) => label(project.type) },
  { id: "cloud", header: "Cloud", cell: (project) => label(project.cloud) },
  {
    id: "duration",
    header: "Weeks",
    className: "text-right tabular-nums",
    cell: (project) => project.duration_weeks,
  },
  {
    id: "effort",
    header: "Person-weeks",
    className: "text-right tabular-nums",
    cell: (project) => project.effort_person_weeks,
  },
  {
    id: "team",
    header: "Team",
    className: "text-right tabular-nums",
    cell: (project) => project.team_size,
  },
]

/** Context only: these numbers never enter the calculation above. */
export function HistoricalPanel({ reference }: { reference: HistoricalProjects }) {
  return (
    <div className="flex flex-col gap-3">
      <Alert>
        <AlertDescription>{reference.disclaimer}</AlertDescription>
      </Alert>
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          rows={reference.projects}
          getRowId={(project) => project.id}
          emptyMessage="No reference projects are seeded."
        />
      </div>
    </div>
  )
}
