/**
 * Light / dark / system, from one token source.
 *
 * The preference is persisted in localStorage; `system` subscribes to
 * `prefers-color-scheme` so the app flips live when the OS does. The resolved
 * theme is written to `<html>` as the `.dark` class (what the shadcn tokens
 * key off) and as `color-scheme`, so native form controls and scrollbars match.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  readStoredTheme,
  systemTheme,
  ThemeContext,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme-context'

function apply(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme)
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme)

  // Follow the OS while (and only while) the preference is `system`.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === 'system' ? system : theme

  useEffect(() => apply(resolvedTheme), [resolvedTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* storage unavailable - the choice still applies for this session */
    }
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
