import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { IdBadge } from "@/components/shared/IdBadge"
import { OriginBadge } from "@/components/shared/OriginBadge"
import { PriorityBadge } from "@/components/shared/PriorityBadge"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeItem } from "@/api/types"

/** Where the item came from: the first cited segment, or why there is no citation. */
function sourceCell(item: ScopeItem) {
  const first = item.source_refs?.[0]
  if (first) {
    return (
      <div className="flex items-center gap-1">
        <IdBadge id={first.segment_id} />
        {item.source_refs && item.source_refs.length > 1 ? (
          <span className="text-xs text-muted-foreground">+{item.source_refs.length - 1} more</span>
        ) : null}
      </div>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      {item.absence_note || "Not stated by the customer"}
    </span>
  )
}

const columns: readonly DataTableColumn<ScopeItem>[] = [
  { id: "id", header: "Id", cell: (item) => <IdBadge id={item.id} /> },
  { id: "type", header: "Type", cell: (item) => label(item.type) },
  {
    id: "title",
    header: "Title",
    className: "max-w-80",
    cell: (item) => (
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{item.title}</span>
        {item.description ? (
          <span className="truncate text-xs text-muted-foreground">{item.description}</span>
        ) : null}
      </div>
    ),
  },
  {
    id: "priority",
    header: "Priority",
    cell: (item) => <PriorityBadge priority={item.priority} />,
  },
  { id: "origin", header: "Origin", cell: (item) => <OriginBadge origin={item.origin} /> },
  {
    id: "status",
    header: "Status",
    cell: (item) => (
      <Badge variant={toneBadgeVariant(statusTone(item.status))}>{label(item.status)}</Badge>
    ),
  },
  { id: "source", header: "Source", cell: sourceCell },
]

interface ScopeTableProps {
  items: readonly ScopeItem[]
  onSelect: (item: ScopeItem) => void
}

export function ScopeTable({ items, onSelect }: ScopeTableProps) {
  return (
    <DataTable
      columns={columns}
      rows={items}
      getRowId={(item) => item.id}
      onRowClick={onSelect}
      dense
      emptyMessage="No scope item matches these filters."
    />
  )
}
