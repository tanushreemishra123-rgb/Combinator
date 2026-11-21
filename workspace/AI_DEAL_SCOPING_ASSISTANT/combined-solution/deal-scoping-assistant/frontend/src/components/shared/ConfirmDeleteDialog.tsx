import type { ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ConfirmDeleteDialogProps {
  /** The button that opens the dialog. */
  trigger: ReactNode
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  pending?: boolean
  onConfirm: () => void
}

/** Every destructive action asks first, with the same wording and buttons. */
export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
