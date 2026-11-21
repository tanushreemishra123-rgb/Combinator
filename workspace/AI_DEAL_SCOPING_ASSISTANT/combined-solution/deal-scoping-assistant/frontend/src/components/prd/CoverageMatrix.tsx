import { CheckIcon, MinusIcon } from "lucide-react"
import { coverageColumns } from "@/components/prd/coverage"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { IdBadge } from "@/components/shared/IdBadge"
import { coverageColumnLabel, label } from "@/lib/labels"
import type { CoverageColumn, CoverageReport, CoverageRow } from "@/api/types"

interface CoverageMatrixProps {
  report: CoverageReport
  onSelectId?: (id: string) => void
}

function cellFor(row: CoverageRow, column: CoverageColumn) {
  const cell = row.cells?.find((candidate) => candidate.column === column)
  if (!cell?.covered) {
    return (
      <span aria-label={`Not covered in ${coverageColumnLabel(column)}`}>
        <MinusIcon className="size-4 text-muted-foreground" aria-hidden />
      </span>
    )
  }
  return (
    <span
      aria-label={`Covered in ${coverageColumnLabel(column)} by ${cell.element_ids?.join(", ") || "an element"}`}
      title={cell.element_ids?.join(", ")}
    >
      <CheckIcon className="size-4 text-success" aria-hidden />
    </span>
  )
}

/** Rows are scope items, columns are the deliverables that reference them. */
export function CoverageMatrix({ report, onSelectId }: CoverageMatrixProps) {
  const columns = coverageColumns(report)
  const tableColumns: DataTableColumn<CoverageRow>[] = [
    {
      id: "item",
      header: "Requirement",
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <IdBadge id={row.item_id} onSelect={onSelectId} />
          <span className="text-xs text-muted-foreground">{row.title}</span>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (row) => label(row.item_type) },
    { id: "priority", header: "Priority", cell: (row) => label(row.priority) },
    ...columns.map((column) => ({
      id: column,
      header: coverageColumnLabel(column),
      className: "text-center",
      cell: (row: CoverageRow) => cellFor(row, column),
    })),
  ]

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={tableColumns}
        rows={report.rows ?? []}
        getRowId={(row) => row.item_id}
        emptyMessage="No coverage rows yet."
      />
    </div>
  )
}
