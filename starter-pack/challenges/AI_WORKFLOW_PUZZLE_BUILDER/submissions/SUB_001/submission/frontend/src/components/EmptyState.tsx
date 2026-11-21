/** The "nothing here yet" panel - one component, so every empty view matches. */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  Icon: LucideIcon
  title: string
  body?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ Icon, title, body, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {action}
    </div>
  )
}
