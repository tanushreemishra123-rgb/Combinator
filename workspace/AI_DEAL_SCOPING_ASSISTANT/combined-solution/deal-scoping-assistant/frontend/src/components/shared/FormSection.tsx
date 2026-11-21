import type { ReactNode } from "react"
import { FieldLegend, FieldSet } from "@/components/ui/field"

interface FormSectionProps {
  title: string
  /** One line, and only when it states a rule the fields cannot show themselves. */
  hint?: string
  children: ReactNode
}

/** A titled group of related fields; sections sit gap-6 apart inside a form. */
export function FormSection({ title, hint, children }: FormSectionProps) {
  return (
    <FieldSet className="gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <FieldLegend
        variant="label"
        className="text-muted-foreground uppercase tracking-wide text-xs"
      >
        {title}
      </FieldLegend>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {children}
    </FieldSet>
  )
}
