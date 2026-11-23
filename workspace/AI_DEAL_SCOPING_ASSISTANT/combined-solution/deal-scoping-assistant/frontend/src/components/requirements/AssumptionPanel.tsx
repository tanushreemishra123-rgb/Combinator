import { CheckIcon, XIcon } from "lucide-react"
import { useDecideAssumption } from "@/api/hooks/scope"
import { IdBadge } from "@/components/shared/IdBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ScopeItem } from "@/api/types"

interface AssumptionPanelProps {
  sessionId: string
  assumptions: readonly ScopeItem[]
  locked: boolean
  onSelectId: (id: string) => void
}

export function AssumptionPanel({
  sessionId,
  assumptions,
  locked,
  onSelectId,
}: AssumptionPanelProps) {
  const decide = useDecideAssumption(sessionId)

  return (
    <>
      {assumptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assumptions were made.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assumptions.map((assumption) => {
            const status = assumption.details?.assumption?.confirmation_status ?? "pending"
            return (
              <li key={assumption.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <IdBadge id={assumption.id} onSelect={onSelectId} />
                  <Badge variant={toneBadgeVariant(statusTone(status))}>{label(status)}</Badge>
                  <span className="font-medium">{assumption.title}</span>
                </div>
                {assumption.details?.assumption?.impact_if_wrong ? (
                  <p className="text-sm text-muted-foreground">
                    If it is wrong: {assumption.details.assumption.impact_if_wrong}
                  </p>
                ) : null}
                {!locked ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ itemId: assumption.id, confirmed: true })}
                    >
                      <CheckIcon data-icon="inline-start" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ itemId: assumption.id, confirmed: false })}
                    >
                      <XIcon data-icon="inline-start" />
                      Reject
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
