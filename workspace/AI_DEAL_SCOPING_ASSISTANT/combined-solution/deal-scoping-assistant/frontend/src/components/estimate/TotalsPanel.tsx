import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge"
import { KeyValueList } from "@/components/shared/KeyValueList"
import { TraceTable } from "@/components/shared/TraceTable"
import { Badge } from "@/components/ui/badge"
import type { Estimate } from "@/api/types"

function money(amount: number, currency: string): string {
  return `${amount.toLocaleString()} ${currency}`
}

/** The headline numbers, each one reproducible from the trace underneath. */
export function TotalsPanel({ estimate }: { estimate: Estimate }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={estimate.overall_confidence} />
        {estimate.totals_partial ? (
          <Badge variant="danger">Totals incomplete — some lines are blocked</Badge>
        ) : null}
      </div>
      <KeyValueList
        items={[
          {
            label: "Effort",
            value: `${estimate.effort_low}–${estimate.effort_high} person-weeks`,
          },
          {
            label: "Effort incl. contingency",
            value: `${estimate.effort_incl_contingency_low}–${estimate.effort_incl_contingency_high} person-weeks (information only — contingency is priced once, in the ROM)`,
          },
          {
            label: "Timeline",
            value: `${estimate.timeline_weeks_low}–${estimate.timeline_weeks_high} weeks`,
          },
          {
            label: "ROM commercials",
            value: `${money(estimate.rom.amount_low, estimate.rom.currency)} – ${money(estimate.rom.amount_high, estimate.rom.currency)}`,
          },
          {
            label: "Commercial basis",
            value: `${estimate.rom.rate_basis} · contingency ${estimate.rom.contingency_pct}% · rate card ${estimate.rate_card_id}`,
          },
        ]}
      />
      {estimate.deadline_risk ? (
        <p className="text-sm text-destructive">{estimate.deadline_risk}</p>
      ) : null}
      {estimate.confidence_limitations.length > 0 ? (
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm text-muted-foreground">
          {estimate.confidence_limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      ) : null}
      <TraceTable entries={estimate.trace} label="Show calculation for the totals" />
    </div>
  )
}
