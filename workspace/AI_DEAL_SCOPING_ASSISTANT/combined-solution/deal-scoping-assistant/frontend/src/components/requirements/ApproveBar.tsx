import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react"
import { useApproveScope } from "@/api/hooks/scope"
import { summarizeApproval } from "@/components/requirements/approval"
import { ITEM_STATUSES } from "@/components/requirements/scopeItems"
import { ErrorState } from "@/components/shared/ErrorState"
import { IdList } from "@/components/shared/IdList"
import { StageButton } from "@/components/shared/StageButton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { label } from "@/lib/labels"
import type { ScopeView } from "@/api/types"

interface ApproveBarProps {
  sessionId: string
  scope: ScopeView | undefined
  onSelectId: (id: string) => void
}

export function ApproveBar({ sessionId, scope, onSelectId }: ApproveBarProps) {
  const approve = useApproveScope(sessionId)
  const summary = summarizeApproval(scope)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approve the requirements</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {summary.total} {summary.total === 1 ? "item" : "items"}
          </Badge>
          {ITEM_STATUSES.map((status) => (
            <Badge key={status} variant="ghost">
              {label(status)}: {summary.counts.get(status) ?? 0}
            </Badge>
          ))}
          {summary.pendingAssumptions > 0 ? (
            <Badge variant="outline">{summary.pendingAssumptions} assumptions pending</Badge>
          ) : null}
        </div>

        {summary.unresolvedCritical.length > 0 ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              {summary.unresolvedCritical.length} critical question
              {summary.unresolvedCritical.length === 1 ? " is" : "s are"} still open
            </AlertTitle>
            <AlertDescription>
              <span>
                Approving now carries the matching assumptions into every downstream deliverable.
              </span>
              <IdList
                ids={summary.unresolvedCritical.map((question) => question.id)}
                label="Open critical questions"
                onSelect={onSelectId}
              />
            </AlertDescription>
          </Alert>
        ) : null}

        {approve.isError ? <ErrorState error={approve.error} /> : null}

        <StageButton
          running={approve.isPending}
          stage="Recording the approved scope version"
          disabled={!summary.canApprove}
          onClick={() => approve.mutate()}
        >
          <CheckCircle2Icon data-icon="inline-start" />
          Approve scope
        </StageButton>
        {summary.blockedReason ? (
          <p className="text-sm text-muted-foreground">{summary.blockedReason}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
