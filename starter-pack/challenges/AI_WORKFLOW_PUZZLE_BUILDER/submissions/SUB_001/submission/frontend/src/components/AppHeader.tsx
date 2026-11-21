/**
 * The one app header. Both pages compose it: a left slot for identity, a right
 * slot for page actions, then the two things that are always there - the
 * mock/live pill and the theme toggle.
 */

import ModeBadge from '@/components/ModeBadge'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
  /**
   * Lets a page drop the live/mock pill at the widths where it would crowd the
   * actions out of the bar. The builder needs it; the gallery has the room.
   */
  modeBadgeClassName?: string
}

export default function AppHeader({ children, actions, className, modeBadgeClassName }: Props) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-5',
        className,
      )}
    >
      {children}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {actions}
        <ModeBadge className={modeBadgeClassName} />
        <ThemeToggle />
      </div>
    </header>
  )
}
