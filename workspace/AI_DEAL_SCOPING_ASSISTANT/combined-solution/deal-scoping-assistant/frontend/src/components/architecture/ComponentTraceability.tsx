import { requirementTrace } from "@/components/architecture/componentTrace"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import type { ArchitectureComponent } from "@/api/types"
import type { TraceRow } from "@/components/architecture/componentTrace"

interface ComponentTraceabilityProps {
  components: readonly ArchitectureComponent[]
  onSelectId?: (id: string) => void
}

export function ComponentTraceability({ components, onSelectId }: ComponentTraceabilityProps) {
  const rows = requirementTrace(components)
  const columns: readonly DataTableColumn<TraceRow>[] = [
    {
      id: "requirement",
      header: "Requirement or assumption",
      cell: (row) => <IdBadge id={row.requirementId} onSelect={onSelectId} />,
    },
    {
      id: "components",
      header: "Supported by",
      cell: (row) => (
        <IdList
          ids={row.componentIds}
          label={`Components for ${row.requirementId}`}
          onSelect={onSelectId}
        />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.requirementId}
      emptyMessage="No component names a requirement yet."
    />
  )
}
