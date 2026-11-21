/**
 * A block's lucide icon in a muted, category-tinted chip.
 *
 * The tint comes from `.cat-tint` + `data-category`, so Core / Reliability /
 * Human Control read the same wherever a block appears - palette, canvas node,
 * inspector header, puzzle brief.
 */

import type { BlockType } from '@/api/types'
import { CATALOG, type BlockCategory } from '@/blocks/catalog'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'size-6 rounded-md [&>svg]:size-3.5',
  md: 'size-8 rounded-lg [&>svg]:size-4',
  lg: 'size-10 rounded-xl [&>svg]:size-5',
} as const

interface Props {
  type: BlockType
  size?: keyof typeof SIZES
  className?: string
}

export default function CategoryIcon({ type, size = 'md', className }: Props) {
  const meta = CATALOG[type] // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: type is the BlockType union, not user input
  const Icon = meta.Icon
  return (
    <span
      data-category={meta.category satisfies BlockCategory}
      aria-hidden="true"
      className={cn(
        'cat-tint inline-flex shrink-0 items-center justify-center bg-(--tint)/10 text-(--tint)',
        SIZES[size], // nosemgrep: gitlab.eslint.detect-object-injection -- typed key lookup: size is `keyof typeof SIZES`, not user input
        className,
      )}
    >
      <Icon />
    </span>
  )
}
