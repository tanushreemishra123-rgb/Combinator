import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { label } from "@/lib/labels"
import type { ChangeRecord } from "@/api/types"

interface ChangeHistoryProps {
  changes: readonly ChangeRecord[]
  onOpen: (record: ChangeRecord) => void
}

export function ChangeHistory({ changes, onOpen }: ChangeHistoryProps) {
  if (changes.length === 0) {
    return <p className="text-sm text-muted-foreground">No change has been recorded yet.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {changes.map((record) => (
        <li
          key={record.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2"
        >
          <Badge variant="outline">v{record.scope_version}</Badge>
          <span className="font-medium">{label(record.request.change_type)}</span>
          <span className="text-sm text-muted-foreground">
            {record.request.description || "No note"}
          </span>
          <span className="text-xs text-muted-foreground">{formatDateTime(record.created_at)}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onOpen(record)}>
            View impact
          </Button>
        </li>
      ))}
    </ul>
  )
}
