import { Link } from "react-router"
import { FolderOpenIcon } from "lucide-react"
import { useSessions } from "@/api/hooks/sessions"
import { DeleteSessionDialog } from "@/components/sessions/DeleteSessionDialog"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import { label } from "@/lib/labels"
import type { Session } from "@/api/types"

const columns: readonly DataTableColumn<Session>[] = [
  {
    id: "name",
    header: "Session",
    cell: (session) => (
      <div className="flex flex-col">
        <Link to={`/sessions/${session.id}/requirements`} className="font-medium hover:underline">
          {session.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {session.customer_name || "Customer not set"}
        </span>
      </div>
    ),
  },
  {
    id: "scope",
    header: "Scope",
    cell: (session) => (
      <Badge variant={session.scope_status === "approved" ? "default" : "outline"}>
        {label(session.scope_status)}
      </Badge>
    ),
  },
  {
    id: "version",
    header: "Version",
    className: "tabular-nums",
    cell: (session) => session.scope_version,
  },
  { id: "updated", header: "Updated", cell: (session) => formatDateTime(session.updated_at) },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "text-right",
    cell: (session) => <DeleteSessionDialog session={session} />,
  },
]

export function SessionList() {
  const sessions = useSessions()

  if (sessions.isPending) return <LoadingState lines={4} label="Loading sessions" />
  if (sessions.isError)
    return <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
  if (sessions.data.length === 0) {
    return (
      <EmptyState
        icon={FolderOpenIcon}
        title="No sessions yet"
        description="Create a session, or start from a sample scenario."
        action={
          <Button asChild variant="outline">
            <Link to="/scenarios">Browse sample scenarios</Link>
          </Button>
        }
      />
    )
  }

  return <DataTable columns={columns} rows={sessions.data} getRowId={(session) => session.id} />
}
