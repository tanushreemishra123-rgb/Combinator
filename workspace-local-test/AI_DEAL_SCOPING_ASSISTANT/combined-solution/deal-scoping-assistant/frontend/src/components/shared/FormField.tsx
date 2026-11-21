import type { ReactNode } from "react"
import { cn } from "cn"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface FormFieldProps {
  /** Must match the control's id so the label stays associated. */
  id: string
  label: string
  /** Only for a rule the field cannot show by itself. */
  description?: string
  error?: { message?: string }
  /** Marked only where the API rejects an empty value. */
  required?: boolean
  /** Why the control is disabled; shown on hover and to screen readers. */
  disabledReason?: string
  className?: string
  children: ReactNode
}

export function FormField({
  id,
  label,
  description,
  error,
  required = false,
  disabledReason,
  className,
  children,
}: FormFieldProps) {
  const field = (
    <Field
      data-invalid={error ? true : undefined}
      data-disabled={disabledReason ? true : undefined}
      className={cn(className)}
    >
      <FieldLabel htmlFor={id}>
        {label}
        {required ? (
          <span className="text-danger" title="Required">
            *
          </span>
        ) : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError className="text-danger" errors={[error]} /> : null}
    </Field>
  )

  if (!disabledReason) return field
  return (
    <Tooltip>
      <TooltipTrigger asChild>{field}</TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  )
}
