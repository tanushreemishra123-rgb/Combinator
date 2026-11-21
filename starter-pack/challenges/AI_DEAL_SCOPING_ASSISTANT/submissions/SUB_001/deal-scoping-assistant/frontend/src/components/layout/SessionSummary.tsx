import { Badge } from "@/components/ui/badge"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeStatus } from "@/api/types"

interface SessionSummaryProps {
  customerName?: string
  scopeVersion?: number
  scopeStatus?: ScopeStatus
}

/** Who this session is for and where its scope stands, at the top of the sidebar. */
export function SessionSummary({ customerName, scopeVersion, scopeStatus }: SessionSummaryProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{customerName || "Customer not set"}</span>
      <div className="flex flex-wrap items-center gap-2">
        {scopeStatus ? (
          <Badge
            variant={toneBadgeVariant(statusTone(scopeStatus))}
            aria-label={`Scope status: ${label(scopeStatus)}`}
          >
            {label(scopeStatus)}
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Scope v<span className="tabular-nums">{scopeVersion ?? "—"}</span>
        </span>
      </div>
    </div>
  )
}
