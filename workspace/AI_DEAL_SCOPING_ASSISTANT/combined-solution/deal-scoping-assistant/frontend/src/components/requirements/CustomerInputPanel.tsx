import { useState } from "react"
import { ChevronDownIcon, PencilIcon } from "lucide-react"
import { ContextForm } from "@/components/requirements/ContextForm"
import { DocumentInput } from "@/components/requirements/DocumentInput"
import { DocumentList } from "@/components/requirements/DocumentList"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import type { DocumentSummary, Session } from "@/api/types"

interface CustomerInputPanelProps {
  session: Session
  documents: readonly DocumentSummary[]
  documentsError: unknown
  itemCount: number
  locked: boolean
}

/** Expanded while there is nothing to review; a one-line summary once the scope exists. */
export function CustomerInputPanel({
  session,
  documents,
  documentsError,
  itemCount,
  locked,
}: CustomerInputPanelProps) {
  const analyzed = session.scope_status !== "empty"
  const [choice, setChoice] = useState<boolean | null>(null)
  const open = choice ?? !analyzed

  const summary = `${documents.length} ${documents.length === 1 ? "document" : "documents"}, ${itemCount} ${itemCount === 1 ? "item" : "items"} extracted`

  return (
    <SectionCard
      title="Customer input"
      actions={
        analyzed ? (
          <Button variant="ghost" size="sm" onClick={() => setChoice(!open)}>
            {open ? (
              <ChevronDownIcon data-icon="inline-start" />
            ) : (
              <PencilIcon data-icon="inline-start" />
            )}
            {open ? "Hide input" : "Edit input"}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {analyzed && !open ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
        <Collapsible open={open}>
          <CollapsibleContent className="flex flex-col gap-4">
            <ContextForm session={session} />
            {!locked ? <DocumentInput sessionId={session.id} /> : null}
            {documentsError ? (
              <ErrorState error={documentsError} />
            ) : (
              <DocumentList
                sessionId={session.id}
                documents={documents}
                deletable={session.scope_status === "empty"}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </SectionCard>
  )
}
