import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { IdBadge } from "@/components/shared/IdBadge"
import { label } from "@/lib/labels"
import type { TraceabilityEntry } from "@/api/types"

interface TraceabilitySectionProps {
  entries: readonly TraceabilityEntry[]
  onSelectId?: (id: string) => void
}

export function TraceabilitySection({ entries, onSelectId }: TraceabilitySectionProps) {
  if (entries.length === 0) return null

  const columns: readonly DataTableColumn<TraceabilityEntry>[] = [
    {
      id: "req",
      header: "Requirement",
      cell: (entry) => <IdBadge id={entry.req_id} onSelect={onSelectId} />,
    },
    {
      id: "sections",
      header: "Appears in",
      cell: (entry) => entry.sections.map((section) => label(section)).join(", "),
    },
  ]

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium tracking-tight">Requirement traceability</h3>
      <DataTable columns={columns} rows={entries} getRowId={(entry) => entry.req_id} />
    </section>
  )
}
