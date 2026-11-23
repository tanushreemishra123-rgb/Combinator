import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import type { RateCard } from "@/api/types"

interface RoleRateRowsProps {
  form: UseFormReturn<EstimationConfigValues>
  card: RateCard | undefined
}

/** Rate per role for this session: the card's value until it is edited. */
export function RoleRateRows({ form, card }: RoleRateRowsProps) {
  const errors = form.formState.errors.role_rates
  const rows = useWatch({ control: form.control, name: "role_rates" }) ?? []

  if (!card || rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Role rates for this session. A changed rate replaces the card rate for this deal only and is
        written into the estimate assumptions.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead className="w-40">Rate per person-week ({card.currency})</TableHead>
            <TableHead className="w-32">Card rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const seeded = card.rates.find((rate) => rate.role === row.role)?.rate_per_person_week
            const changed = seeded !== undefined && Number(row.rate) !== seeded
            const error = Array.isArray(errors) ? errors.at(index)?.rate : undefined
            const id = `config-rate-${index}`
            return (
              <TableRow key={row.role} className="[&>td]:py-1.5">
                <TableCell>
                  <label htmlFor={id}>{row.role}</label>
                </TableCell>
                <TableCell>
                  <Input
                    id={id}
                    inputMode="numeric"
                    type="number"
                    min={0}
                    step={100}
                    aria-invalid={Boolean(error)}
                    className="w-32"
                    {...form.register(`role_rates.${index}.rate`)}
                  />
                  {error ? <p className="pt-1 text-xs text-danger">{error.message}</p> : null}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {changed ? `was ${seeded.toLocaleString()}` : "as card"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
