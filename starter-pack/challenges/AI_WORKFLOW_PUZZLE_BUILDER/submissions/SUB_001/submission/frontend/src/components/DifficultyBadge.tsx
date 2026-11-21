import type { Difficulty } from '@/api/types'
import { cn } from '@/lib/utils'

const META: Record<Difficulty, { label: string; className: string }> = {
  beginner: { label: 'Beginner', className: 'bg-diff-beginner/12 text-diff-beginner' },
  intermediate: {
    label: 'Intermediate',
    className: 'bg-diff-intermediate/12 text-diff-intermediate',
  },
  advanced: { label: 'Advanced', className: 'bg-diff-advanced/12 text-diff-advanced' },
}

export default function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty
  className?: string
}) {
  const meta = META[difficulty] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: difficulty is the Difficulty union, not user input
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-4xl px-2 text-[0.7rem] font-semibold whitespace-nowrap',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
