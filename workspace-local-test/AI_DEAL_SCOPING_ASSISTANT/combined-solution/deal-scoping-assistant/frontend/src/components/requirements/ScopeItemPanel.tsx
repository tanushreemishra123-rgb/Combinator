import { useState } from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { useDeleteScopeItem } from "@/api/hooks/scope"
import { ScopeItemDetail } from "@/components/requirements/ScopeItemDetail"
import { ScopeItemForm } from "@/components/requirements/ScopeItemForm"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog"
import type { ScopeItem, ScopeView } from "@/api/types"

interface ScopeItemPanelProps {
  sessionId: string
  item: ScopeItem
  scope: ScopeView | undefined
  readOnly: boolean
  onClose: () => void
  onSelectId?: (id: string) => void
}

/** Body of the detail sheet. Mounted per item id, so edit mode never leaks between items. */
export function ScopeItemPanel({
  sessionId,
  item,
  scope,
  readOnly,
  onClose,
  onSelectId,
}: ScopeItemPanelProps) {
  const [editing, setEditing] = useState(false)
  const remove = useDeleteScopeItem(sessionId)

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      {!readOnly && !editing ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon data-icon="inline-start" />
            Edit item
          </Button>
          <ConfirmDeleteDialog
            trigger={
              <Button variant="ghost" size="sm">
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
            }
            title={`Delete ${item.id}?`}
            description="The item and its source references are removed from the scope model."
            cancelLabel="Keep item"
            confirmLabel="Delete item"
            pending={remove.isPending}
            onConfirm={() => remove.mutate(item.id, { onSuccess: onClose })}
          />
        </div>
      ) : null}
      {editing ? (
        <ScopeItemForm sessionId={sessionId} item={item} onDone={() => setEditing(false)} />
      ) : (
        <ScopeItemDetail sessionId={sessionId} item={item} scope={scope} onSelectId={onSelectId} />
      )}
    </div>
  )
}
