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
import { label } from "@/lib/labels"
import type { EstimationConfigValues } from "@/components/estimate/estimationConfigValues"
import type { TeamSizeEntry } from "@/api/types"

interface TeamSizeRowsProps {
  form: UseFormReturn<EstimationConfigValues>
  teamSizes: readonly TeamSizeEntry[]
}

/** People per workstream type: a compact table rather than one stacked field each. */
export function TeamSizeRows({ form, teamSizes }: TeamSizeRowsProps) {
  const errors = form.formState.errors.team_sizes
  const rows = teamSizes.map((entry, index) => ({
    entry,
    index,
    error: Array.isArray(errors) ? errors.at(index)?.team_size : undefined,
  }))

  if (rows.length === 0) return null

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Workstream type</TableHead>
          <TableHead className="w-32">People</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ entry, index, error }) => (
          <TableRow key={entry.workstream_type} className="[&>td]:py-1.5">
            <TableCell>
              <label htmlFor={`config-team-${entry.workstream_type}`}>
                {label(entry.workstream_type)}
              </label>
            </TableCell>
            <TableCell>
              <Input
                id={`config-team-${entry.workstream_type}`}
                inputMode="numeric"
                type="number"
                min={1}
                step={1}
                aria-invalid={Boolean(error)}
                className="w-24"
                {...form.register(`team_sizes.${index}.team_size`)}
              />
              {error ? <p className="pt-1 text-xs text-danger">{error.message}</p> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
