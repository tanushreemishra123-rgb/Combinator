import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { label as toLabel } from "@/lib/labels"

interface FilterSelectProps<T extends string> {
  /** Accessible name of the filter, e.g. "Type". */
  name: string
  allLabel: string
  value: T | "all"
  options: readonly T[]
  onChange: (value: T | "all") => void
  format?: (value: T) => string
  className?: string
}

export function FilterSelect<T extends string>({
  name,
  allLabel,
  value,
  options,
  onChange,
  format = toLabel,
  className,
}: FilterSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T | "all")}>
      <SelectTrigger aria-label={name} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format(option)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
