import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { IdList } from "@/components/shared/IdList"
import type { Finding } from "@/api/types"

interface FindingsNoticeProps {
  findings: readonly Finding[]
  onSelectId?: (id: string) => void
}

/** Validator output from a stage: folded away by default so it never hides the result. */
export function FindingsNotice({ findings, onSelectId }: FindingsNoticeProps) {
  if (findings.length === 0) return null
  const errors = findings.filter((finding) => finding.level === "error").length
  const warnings = findings.length - errors
  const summary = [
    errors > 0 ? `${errors} error${errors === 1 ? "" : "s"}` : null,
    warnings > 0 ? `${warnings} warning${warnings === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" and ")

  return (
    <Collapsible>
      <Alert variant={errors > 0 ? "destructive" : "default"}>
        <TriangleAlertIcon />
        <AlertTitle>The analysis reported {summary}</AlertTitle>
        <AlertDescription>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronDownIcon data-icon="inline-start" />
              Show what was found
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col gap-2 pt-2">
              {findings.map((finding, index) => (
                <li key={`${finding.message}-${index}`} className="flex flex-col gap-1">
                  <span>{finding.message}</span>
                  <IdList
                    ids={finding.ids ?? []}
                    label="Items this finding is about"
                    onSelect={onSelectId}
                  />
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  )
}
