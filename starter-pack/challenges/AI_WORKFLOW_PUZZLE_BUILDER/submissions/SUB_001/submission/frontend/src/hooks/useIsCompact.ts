/**
 * True below Tailwind's `lg` breakpoint - the width at which the builder trades
 * its two side rails for slide-over drawers.
 *
 * The breakpoint has to exist in JavaScript as well as CSS because the rails
 * hold state: the palette and the inspector must be mounted exactly once, in
 * one place or the other, never in both at the same time.
 */

import { useSyncExternalStore } from 'react'

/** Mirrors Tailwind's `lg`, in the same unit Tailwind uses, so the two agree. */
const DESKTOP = '(min-width: 64rem)'

let query: MediaQueryList | null = null

function desktop(): MediaQueryList {
  query ??= window.matchMedia(DESKTOP)
  return query
}

function subscribe(onChange: () => void): () => void {
  const media = desktop()
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !desktop().matches,
    () => false,
  )
}
