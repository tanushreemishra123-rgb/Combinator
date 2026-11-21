/** Small icon + title heading used by the brief, the report and the run panels. */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  Icon: LucideIcon
  children: React.ReactNode
  /** Tailwind text colour utility for the icon; defaults to the muted foreground. */
  tone?: string
  className?: string
}

export default function SectionHeading({ Icon, children, tone, className }: Props) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5', tone)} />
      {children}
    </h3>
  )
}
