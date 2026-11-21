/**
 * One pill for every run status, coloured from the `--status-*` tokens.
 *
 * Every surface that shows "how did this step end" - canvas node, trace entry,
 * step inspector, run badge - goes through here, so the vocabulary and the
 * colours can only be changed in one place.
 */

import type { StepStatus } from '@/api/types'
import { STATUS_ICONS, STATUS_LABELS } from '@/components/status'
import { cn } from '@/lib/utils'

interface Props {
  status: StepStatus
  /** Override the wording (the inspector prints the raw status). */
  label?: string
  className?: string
}

export default function StatusBadge({ status, label, className }: Props) {
  const Icon = STATUS_ICONS[status] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: status is the StepStatus union, not user input
  return (
    <span
      data-status={status}
      className={cn(
        'status-tone inline-flex h-5 items-center gap-1 rounded-4xl px-2 text-xs font-medium whitespace-nowrap',
        'bg-(--tone)/12 text-(--tone)',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3', status === 'running' && 'animate-spin')} />
      {label ?? /* nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: status is the StepStatus union, not user input */ STATUS_LABELS[status]}
    </span>
  )
}
