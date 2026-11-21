/**
 * "Check workflow" results, shown as shadcn/Sonner toasts.
 *
 * A clean check is a short success toast. Warnings and errors keep the
 * clickable message list (click a row to focus the offending block); errors
 * stay on screen until dismissed so nothing is missed.
 */

import { toast } from 'sonner'
import type { ValidateWorkflowResponse } from '@/api/types'
import ValidationMessages from '@/builder/ValidationMessages'

export type ValidationToastId = string | number

/** The toaster mounted over the canvas (see Builder); check results go there, not bottom-right. */
export const CANVAS_TOASTER_ID = 'canvas'

interface Options {
  onFocusNode: (nodeId: string) => void
  /** Called when the toast leaves the screen, however that happens. */
  onDismiss: () => void
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Show the check result as a toast and return its id (for dismissing later). */
export function showValidationToast(
  result: ValidateWorkflowResponse,
  { onFocusNode, onDismiss }: Options,
): ValidationToastId {
  const common = { toasterId: CANVAS_TOASTER_ID, onDismiss, onAutoClose: onDismiss }
  const clean = result.errors.length === 0 && result.warnings.length === 0

  if (clean) {
    return toast.success('Workflow looks good', {
      description: 'No problems found. Ready to run.',
      ...common,
    })
  }

  const description = <ValidationMessages result={result} onFocusNode={onFocusNode} />
  if (result.valid) {
    return toast.warning(
      `Looks buildable, with ${plural(result.warnings.length, 'thing')} to think about`,
      { description, duration: 12_000, ...common },
    )
  }
  return toast.error(`${plural(result.errors.length, 'problem')} to fix`, {
    description,
    duration: Number.POSITIVE_INFINITY,
    ...common,
  })
}

export function dismissValidationToast(id: ValidationToastId | null): void {
  if (id !== null) toast.dismiss(id)
}
