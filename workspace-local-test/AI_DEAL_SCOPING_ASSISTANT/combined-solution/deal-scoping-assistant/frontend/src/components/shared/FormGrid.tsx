import type { ReactNode } from "react"
import { cn } from "cn"
import { lookupTable } from "@/lib/lookup"

export type FormGridColumns = 2 | 3 | 4

// Whole class strings, so Tailwind can see every variant it has to generate.
const COLUMN_CLASSES = lookupTable<string, string>({
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 lg:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
})

interface FormGridProps {
  columns: FormGridColumns
  className?: string
  children: ReactNode
}

/**
 * One column on a phone, two from sm, the asked-for count from lg. A long field opts out
 * with `sm:col-span-2` or `lg:col-span-full` on its own wrapper.
 */
export function FormGrid({ columns, className, children }: FormGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", COLUMN_CLASSES.get(String(columns)), className)}>
      {children}
    </div>
  )
}
