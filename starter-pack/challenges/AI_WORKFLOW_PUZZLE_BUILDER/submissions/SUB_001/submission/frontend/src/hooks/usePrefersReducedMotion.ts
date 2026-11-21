/**
 * True when the OS asks for reduced motion.
 *
 * CSS covers most of it - `canvas.css` switches every canvas animation off
 * under `@media (prefers-reduced-motion: reduce)`. Two things are out of CSS's
 * reach and need the query in JavaScript: the SVG `<animateMotion>` signal dot
 * (SMIL ignores media queries) and React Flow's `fitView({ duration })`.
 */

import { useSyncExternalStore } from 'react'

const REDUCED = '(prefers-reduced-motion: reduce)'

let query: MediaQueryList | null = null

function reduced(): MediaQueryList {
  query ??= window.matchMedia(REDUCED)
  return query
}

function subscribe(onChange: () => void): () => void {
  const media = reduced()
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reduced().matches,
    () => false,
  )
}
