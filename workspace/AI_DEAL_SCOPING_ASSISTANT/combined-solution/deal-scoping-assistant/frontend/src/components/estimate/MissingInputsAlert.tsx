import { TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { label } from "@/lib/labels"
import type { BlockedLine, MissingInput } from "@/api/types"

interface MissingInputsAlertProps {
  missing: readonly MissingInput[]
  blocked: readonly BlockedLine[]
}

/** Missing inputs lower confidence or block a line; nothing is filled in silently. */
export function MissingInputsAlert({ missing, blocked }: MissingInputsAlertProps) {
  if (missing.length === 0 && blocked.length === 0) return null
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>
        {missing.length} missing input{missing.length === 1 ? "" : "s"}
        {blocked.length > 0
          ? ` and ${blocked.length} line${blocked.length === 1 ? "" : "s"} that cannot be calculated`
          : ""}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {missing.map((input) => (
            <li key={input.key}>
              <span className="font-medium">{label(input.key)}:</span> {input.impact}
              {input.affected_components.length > 0
                ? ` Affects ${input.affected_components.join(", ")}.`
                : ""}
            </li>
          ))}
          {blocked.map((line) => (
            <li key={line.label}>
              <span className="font-medium">{line.label}:</span> {line.reason}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
