import { RefreshCwIcon } from "lucide-react"
import { useRegenerateAfterChange } from "@/api/hooks/changes"
import { ErrorState } from "@/components/shared/ErrorState"
import { IdList } from "@/components/shared/IdList"
import { StageButton } from "@/components/shared/StageButton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatDateTime } from "@/lib/format"
import { label } from "@/lib/labels"
import { statusTone, toneBadgeVariant } from "@/lib/status"
import type { ChangeRecord } from "@/api/types"

interface ChangeRecordViewProps {
  sessionId: string
  record: ChangeRecord
  onSelectId?: (id: string) => void
}

/** What the change touched, what it left alone, and the one button that follows through. */
export function ChangeRecordView({ sessionId, record, onSelectId }: ChangeRecordViewProps) {
  const regenerate = useRegenerateAfterChange(sessionId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label(record.request.change_type)}</CardTitle>
        <CardDescription>
          {record.request.description || "No note recorded"} · scope version {record.scope_version}{" "}
          · {formatDateTime(record.created_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {record.narrative ? (
          <p className="text-sm leading-relaxed">
            <Badge variant="ghost" className="mr-2">
              AI summary
            </Badge>
            {record.narrative}
          </p>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Affected outputs</h3>
          {record.affected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing generated is affected.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {record.affected.map((entry) => (
                <li
                  key={`${entry.artifact}-${entry.reason}`}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{label(entry.artifact)}</span>
                    <Badge variant={toneBadgeVariant(statusTone(entry.action))}>
                      {label(entry.action)}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{entry.reason}</span>
                  <IdList
                    ids={entry.element_ids}
                    label={`${label(entry.artifact)} elements`}
                    onSelect={onSelectId}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {record.affected_item_ids.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Affected scope items</h3>
            <IdList
              ids={record.affected_item_ids}
              label="Affected scope items"
              onSelect={onSelectId}
            />
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Left as reviewed</h3>
          {record.unaffected_summary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everything is affected by this change.</p>
          ) : (
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm text-muted-foreground">
              {record.unaffected_summary.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          )}
        </section>

        {record.stale_kinds.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Now out of date</h3>
            <div className="flex flex-wrap gap-1">
              {record.stale_kinds.map((kind) => (
                <Badge key={kind} variant="warning">
                  {label(kind)}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <Separator />
        {regenerate.isError ? <ErrorState error={regenerate.error} /> : null}
        <StageButton
          running={regenerate.isPending}
          stage="Regenerating the affected outputs in dependency order"
          disabled={record.stale_kinds.length === 0}
          onClick={() => regenerate.mutate(record.id)}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Regenerate affected outputs
        </StageButton>
        {record.suggested_actions.length > 0 ? (
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm text-muted-foreground">
            {record.suggested_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
