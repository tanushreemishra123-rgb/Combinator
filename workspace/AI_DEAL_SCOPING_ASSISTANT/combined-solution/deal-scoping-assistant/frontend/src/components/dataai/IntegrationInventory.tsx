import { BasisBadge } from "@/components/shared/BasisBadge"
import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { IdBadge } from "@/components/shared/IdBadge"
import { IdList } from "@/components/shared/IdList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import type { IntegrationItem } from "@/api/types"
import { ArrowRightIcon } from "lucide-react"

interface IntegrationInventoryProps {
  integrations: readonly IntegrationItem[]
  onSelectId?: (id: string) => void
}

export function IntegrationInventory({ integrations, onSelectId }: IntegrationInventoryProps) {
  const columns: readonly DataTableColumn<IntegrationItem>[] = [
    {
      id: "id",
      header: "Integration",
      cell: (item) => (
        <div className="flex flex-col gap-0.5">
          <IdBadge id={item.id} />
          <span className="text-xs text-muted-foreground">{item.name}</span>
        </div>
      ),
    },
    {
      id: "systems",
      header: "Source and target",
      cell: (item) => (
        <span className="inline-flex items-center gap-1">
          {item.source_system}
          <ArrowRightIcon aria-label="to" className="size-3.5 text-muted-foreground" />
          {item.target_system}
        </span>
      ),
    },
    {
      id: "origin",
      header: "Origin",
      cell: (item) => (
        <div className="flex flex-col items-start gap-1">
          <BasisBadge basis={item.basis} />
          {item.validation_required ? <ValidationBadge reason={item.validation_reason} /> : null}
        </div>
      ),
    },
    { id: "direction", header: "Direction", cell: (item) => label(item.direction) },
    {
      id: "pattern",
      header: "Pattern",
      cell: (item) => <Badge variant="outline">{label(item.pattern)}</Badge>,
    },
    { id: "auth", header: "Authentication", cell: (item) => item.auth_approach },
    { id: "errors", header: "Error handling", cell: (item) => item.error_handling },
    { id: "retry", header: "Retries", cell: (item) => item.retry_behavior },
    { id: "monitoring", header: "Monitoring", cell: (item) => item.monitoring },
    { id: "sync", header: "Synchronization", cell: (item) => item.sync_considerations },
    {
      id: "reqs",
      header: "Requirements",
      cell: (item) => (
        <IdList ids={item.req_ids} label={`${item.id} requirements`} onSelect={onSelectId} />
      ),
    },
    {
      id: "components",
      header: "Components",
      cell: (item) => (
        <IdList ids={item.arc_ids} label={`${item.id} components`} onSelect={onSelectId} />
      ),
    },
  ]

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        rows={integrations}
        getRowId={(item) => item.id}
        emptyMessage="No integrations were designed."
      />
    </div>
  )
}
