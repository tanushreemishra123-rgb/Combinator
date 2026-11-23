import { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { useDocument } from "@/api/hooks/documents"
import { SegmentList } from "@/components/requirements/SegmentList"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DocumentSummary } from "@/api/types"

interface NormalizedPreviewProps {
  sessionId: string
  documents: readonly DocumentSummary[]
}

export function NormalizedPreview({ sessionId, documents }: NormalizedPreviewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const documentId = selected ?? documents[0]?.id
  const document = useDocument(sessionId, documentId)

  if (documents.length === 0) return null

  return (
    <SectionCard
      title="Normalized content"
      actions={
        documents.length > 1 ? (
          <Select value={documentId} onValueChange={setSelected}>
            <SelectTrigger className="w-56" aria-label="Document to preview">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {documents.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null
      }
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" aria-expanded={open}>
            {open ? (
              <ChevronUpIcon data-icon="inline-start" />
            ) : (
              <ChevronDownIcon data-icon="inline-start" />
            )}
            {open ? "Hide normalized content" : "Show normalized content"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {document.isPending ? <LoadingState lines={5} label="Loading the document" /> : null}
          {document.isError ? (
            <ErrorState error={document.error} onRetry={() => document.refetch()} />
          ) : null}
          {document.data ? (
            // The source can be long; the workflow below it must stay reachable.
            <div className="scroll-fade-b max-h-112 overflow-y-auto pr-1">
              <SegmentList segments={document.data.segments ?? []} />
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </SectionCard>
  )
}
