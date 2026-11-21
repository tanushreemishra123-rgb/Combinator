import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import type { TraceEntry } from "@/api/types"

const columns: readonly DataTableColumn<TraceEntry>[] = [
  { id: "label", header: "Line", cell: (entry) => entry.label },
  {
    id: "formula",
    header: "Formula",
    cell: (entry) => <span className="font-mono text-xs">{entry.formula}</span>,
  },
  {
    id: "inputs",
    header: "Inputs",
    cell: (entry) => (
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {entry.inputs.map((input) => (
          <li key={`${input.name}-${input.value}`}>
            {input.name} = {input.value}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "result",
    header: "Result",
    className: "text-right tabular-nums",
    cell: (entry) => entry.result.toLocaleString(),
  },
]

interface TraceTableProps {
  entries: readonly TraceEntry[]
  label?: string
}

/** Every number can be redone on paper, so the arithmetic is one click away. */
export function TraceTable({ entries, label = "Show calculation" }: TraceTableProps) {
  if (entries.length === 0) return null
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm">
          <ChevronDownIcon data-icon="inline-start" />
          {label}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto pt-2">
          <DataTable
            columns={columns}
            rows={entries}
            getRowId={(entry) => `${entry.label}-${entry.formula}`}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
