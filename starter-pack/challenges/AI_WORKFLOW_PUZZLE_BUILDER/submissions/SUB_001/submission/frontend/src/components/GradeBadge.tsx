/** Reliability grade pill. */

import type { ReliabilityGrade } from '@/api/types'
import { GRADE_META } from '@/components/grades'
import { cn } from '@/lib/utils'

export default function GradeBadge({
  grade,
  className,
}: {
  grade: ReliabilityGrade
  className?: string
}) {
  const meta = GRADE_META[grade] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: grade is the ReliabilityGrade union, not user input
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-4xl px-2.5 text-xs font-semibold',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <meta.Icon aria-hidden="true" className="size-3.5" />
      {meta.title}
    </span>
  )
}
