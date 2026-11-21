import { TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { IdBadge } from "@/components/shared/IdBadge"
import { label } from "@/lib/labels"
import type { UnsupportedAddition } from "@/api/types"

/** Generated elements that point at nothing approved: the reviewer must not have to diff documents. */
export function UnsupportedAdditions({ additions }: { additions: readonly UnsupportedAddition[] }) {
  if (additions.length === 0) return null
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>
        {additions.length} scope addition{additions.length === 1 ? "" : "s"} without an approved
        requirement
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {additions.map((addition) => (
            <li
              key={`${addition.artifact}-${addition.element_id}`}
              className="flex flex-wrap items-center gap-2"
            >
              <IdBadge id={addition.element_id} />
              <span className="text-xs">
                {label(addition.artifact)} · {addition.element_kind}
              </span>
              <span>{addition.reason}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
