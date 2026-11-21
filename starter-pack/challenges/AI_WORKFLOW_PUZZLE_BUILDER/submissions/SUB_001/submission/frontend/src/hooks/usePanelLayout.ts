/**
 * Remembers a resizable group's layout per viewer, in `localStorage`.
 *
 * react-resizable-panels v4 ships `useDefaultLayout` for this, but it owns the
 * storage key (and mangles it) and always persists every commit. The builder
 * needs a key we can name, and needs to skip commits made while the run dock is
 * collapsed - otherwise closing the dock would overwrite the height you spent
 * time dragging to. So the two public props the library exposes, `defaultLayout`
 * and `onLayoutChanged`, are wired up by hand instead.
 *
 * Every storage call is wrapped: private-mode Safari throws on `setItem`, and a
 * hand-edited value must not be able to take the builder down with it. The worst
 * case is simply that sizes stop being remembered.
 */

import { useCallback, useMemo } from 'react'
import type { Layout } from 'react-resizable-panels'

/** A stored layout is only used when every entry is a finite percentage. */
function read(key: string): Layout | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const entries = Object.entries(parsed as Record<string, unknown>)
    if (entries.length === 0) return null
    const layout: Layout = {}
    for (const [id, size] of entries) {
      if (typeof size !== 'number' || !Number.isFinite(size)) return null
      layout[id] = size // nosemgrep: gitlab.eslint.detect-object-injection -- building a fresh object from a validated entry list, not indexing a shared one
    }
    return layout
  } catch {
    return null
  }
}

export interface PanelLayout {
  /** Pass to the group as `defaultLayout`. */
  defaultLayout: Layout
  /** Call from the group's `onLayoutChanged`. */
  save: (layout: Layout) => void
}

/**
 * @param key    localStorage key, e.g. `awpb.builder.h`.
 * @param preset The layout to fall back to, and the one a double-click restores.
 */
export function usePanelLayout(key: string, preset: Layout): PanelLayout {
  // Read storage once per key: later renders must not fight the layout the user
  // is dragging. The preset prop is read directly each render, never copied.
  const stored = useMemo(() => read(key), [key])

  const save = useCallback(
    (layout: Layout) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(layout))
      } catch {
        // No storage (private mode, blocked cookies): sizes just last the session.
      }
    },
    [key],
  )

  return { defaultLayout: stored ?? preset, save }
}
