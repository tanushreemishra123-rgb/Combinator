import { Trash2Icon } from "lucide-react"
import { useDeleteDocument } from "@/api/hooks/documents"
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDateTime } from "@/lib/format"
import { label } from "@/lib/labels"
import type { DocumentSummary } from "@/api/types"

interface DocumentListProps {
  sessionId: string
  documents: readonly DocumentSummary[]
  /** Sources can only be removed before the analysis traces scope items to them. */
  deletable: boolean
}

export function DocumentList({ sessionId, documents, deletable }: DocumentListProps) {
  const remove = useDeleteDocument(sessionId)

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No customer input yet"
        description="Paste text or upload a file to build the scope from."
      />
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2"
        >
          <span className="font-medium">{document.name}</span>
          <Badge variant="outline">{label(document.format)}</Badge>
          <Badge variant="ghost">{label(document.kind)}</Badge>
          <span className="text-xs text-muted-foreground">
            {document.char_count.toLocaleString()} characters · {document.segment_count} segments ·
            added {formatDateTime(document.created_at)}
          </span>
          <div className="ml-auto">
            {deletable ? (
              <ConfirmDeleteDialog
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Remove ${document.name}`}>
                    <Trash2Icon />
                  </Button>
                }
                title={`Remove “${document.name}”?`}
                description="The extracted text is removed from this session. Upload or paste it again if you need it back."
                cancelLabel="Keep document"
                confirmLabel="Remove document"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(document.id)}
              />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    aria-label={`Remove ${document.name}`}
                  >
                    <Trash2Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Scope items reference this text, so it stays once the analysis has run.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
