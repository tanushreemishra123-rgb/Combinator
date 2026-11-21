import { Fragment } from "react"
import type { ReactNode } from "react"
import { cn } from "cn"

export interface KeyValueItem {
  label: string
  value: ReactNode
}

export function KeyValueList({
  items,
  className,
}: {
  items: readonly KeyValueItem[]
  className?: string
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(9rem,auto)_1fr]",
        className,
      )}
    >
      {items.map((item) => (
        <Fragment key={item.label}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-sm">{item.value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}
