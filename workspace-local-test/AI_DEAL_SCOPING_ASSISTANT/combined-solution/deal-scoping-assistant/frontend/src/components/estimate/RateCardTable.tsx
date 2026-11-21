import { DataTable } from "@/components/shared/DataTable"
import type { DataTableColumn } from "@/components/shared/DataTable"
import { Badge } from "@/components/ui/badge"
import type { RateCard, RoleRate } from "@/api/types"

interface RateCardTableProps {
  /** The card as this session prices it: overrides already applied. */
  rateCard: RateCard | null
  overrides?: readonly RoleRate[]
}

/** The rates behind the ROM, so the commercials can be checked by hand. */
export function RateCardTable({ rateCard, overrides = [] }: RateCardTableProps) {
  if (!rateCard) {
    return <p className="text-sm text-muted-foreground">No rate card is selected.</p>
  }
  const overridden = new Set(overrides.map((entry) => entry.role))
  const columns: readonly DataTableColumn<RoleRate>[] = [
    {
      id: "role",
      header: "Role",
      cell: (rate) => (
        <span className="inline-flex items-center gap-2">
          {rate.role}
          {overridden.has(rate.role) ? <Badge variant="secondary">session rate</Badge> : null}
        </span>
      ),
    },
    {
      id: "rate",
      header: `Rate per person-week (${rateCard.currency})`,
      className: "text-right tabular-nums",
      cell: (rate) => rate.rate_per_person_week.toLocaleString(),
    },
  ]
  return <DataTable columns={columns} rows={rateCard.rates} getRowId={(rate) => rate.role} />
}
