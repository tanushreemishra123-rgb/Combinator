import { useRecordChange } from "@/api/hooks/changes"
import { complexityChangeRequest } from "@/components/estimate/routing"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { ErrorState } from "@/components/shared/ErrorState"
import { IdBadge } from "@/components/shared/IdBadge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { label } from "@/lib/labels"
import type { Complexity, EstimateDrivers, EstimateUnit } from "@/api/types"

const COMPLEXITIES: readonly Complexity[] = ["low", "medium", "high", "very_high"]

interface UnitsTableProps {
  sessionId: string
  drivers: EstimateDrivers
}

/**
 * Re-rating a unit is the reviewer's main lever on the effort. Drivers only exist after the
 * scope is approved, so every re-rating is recorded as a change and recalculates the estimate.
 */
export function UnitsTable({ sessionId, drivers }: UnitsTableProps) {
  const recordChange = useRecordChange(sessionId)
  const pending = recordChange.isPending

  const rerate = (unitId: string, complexity: Complexity) =>
    recordChange.mutate(complexityChangeRequest(unitId, complexity))

  const names = new Map(drivers.workstreams.map((workstream) => [workstream.id, workstream.name]))
  const columns: readonly DataTableColumn<EstimateUnit>[] = [
    { id: "unit", header: "Unit", cell: (unit) => <IdBadge id={unit.unit_id} /> },
    { id: "type", header: "Type", cell: (unit) => label(unit.unit_type) },
    {
      id: "workstream",
      header: "Workstream",
      cell: (unit) => names.get(unit.workstream_id) ?? unit.workstream_id,
    },
    {
      id: "drivers",
      header: "Why this complexity",
      cell: (unit) => (unit.drivers.length ? unit.drivers.join("; ") : "Not stated"),
    },
    {
      id: "complexity",
      header: "Complexity",
      cell: (unit) => (
        <Select
          value={unit.complexity}
          disabled={pending}
          onValueChange={(value) => rerate(unit.unit_id, value as Complexity)}
        >
          <SelectTrigger className="w-36" aria-label={`Complexity of ${unit.unit_id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {COMPLEXITIES.map((complexity) => (
                <SelectItem key={complexity} value={complexity}>
                  {label(complexity)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ),
    },
  ]

  const sorted = [...drivers.units].sort((left, right) =>
    left.workstream_id === right.workstream_id
      ? left.unit_id.localeCompare(right.unit_id)
      : left.workstream_id.localeCompare(right.workstream_id),
  )

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        A new rating is recorded as a change and the estimate is recalculated with it.
      </p>
      {recordChange.isError ? <ErrorState error={recordChange.error} /> : null}
      <div className="overflow-x-auto">
        <DataTable
          columns={columns}
          rows={sorted}
          getRowId={(unit) => unit.unit_id}
          emptyMessage="No estimate units yet."
        />
      </div>
    </div>
  )
}
