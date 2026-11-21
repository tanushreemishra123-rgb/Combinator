import type { ReactNode } from "react"
import { BasisBadge } from "@/components/shared/BasisBadge"
import { IdList } from "@/components/shared/IdList"
import { ValidationBadge } from "@/components/shared/ValidationBadge"
import type { GroundedElement } from "@/api/types"

interface GroundedItemProps {
  title?: ReactNode
  text?: ReactNode
  element: GroundedElement
  onSelectId?: (id: string) => void
  children?: ReactNode
}

/** Every generated statement shows what it rests on and whether a human must check it. */
export function GroundedItem({ title, text, element, onSelectId, children }: GroundedItemProps) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {title ? <span className="font-medium">{title}</span> : null}
        <BasisBadge basis={element.basis} />
        {element.validation_required ? (
          <ValidationBadge reason={element.validation_reason} />
        ) : null}
      </div>
      {text ? <p className="text-sm leading-relaxed">{text}</p> : null}
      {children}
      <IdList ids={element.req_ids} label="Grounded in" onSelect={onSelectId} />
    </li>
  )
}
