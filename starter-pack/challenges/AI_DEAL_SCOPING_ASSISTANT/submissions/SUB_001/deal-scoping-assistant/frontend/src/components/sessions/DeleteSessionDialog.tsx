import { Trash2Icon } from "lucide-react"
import { useDeleteSession } from "@/api/hooks/sessions"
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog"
import { Button } from "@/components/ui/button"
import type { Session } from "@/api/types"

export function DeleteSessionDialog({ session }: { session: Session }) {
  const deleteSession = useDeleteSession()

  return (
    <ConfirmDeleteDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Delete ${session.name}`}>
          <Trash2Icon />
        </Button>
      }
      title={`Delete “${session.name}”?`}
      description="The requirements, scope model and every generated deliverable in this session are removed. This cannot be undone."
      cancelLabel="Keep session"
      confirmLabel="Delete session"
      pending={deleteSession.isPending}
      onConfirm={() => deleteSession.mutate(session.id)}
    />
  )
}
