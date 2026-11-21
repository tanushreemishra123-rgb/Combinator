import { FormField } from "@/components/shared/FormField"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { label as toLabel } from "@/lib/labels"

interface SelectFieldProps<T extends string> {
  id: string
  label: string
  description?: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  format?: (value: T) => string
  /** Shown while the value is empty or not one of the options. */
  placeholder?: string
  required?: boolean
  disabledReason?: string
  className?: string
}

/** A labelled Select for one of the API's value unions. */
export function SelectField<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
  format = toLabel,
  placeholder,
  required = false,
  disabledReason,
  className,
}: SelectFieldProps<T>) {
  return (
    <FormField
      id={id}
      label={label}
      description={description}
      required={required}
      disabledReason={disabledReason}
      className={className}
    >
      <Select
        value={value}
        disabled={Boolean(disabledReason)}
        onValueChange={(next) => onChange(next as T)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {format(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormField>
  )
}
