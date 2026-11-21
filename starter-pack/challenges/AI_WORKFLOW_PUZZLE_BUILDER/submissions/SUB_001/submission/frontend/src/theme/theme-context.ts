/**
 * Theme state, kept out of the provider file so the provider module exports a
 * component and nothing else (react/only-export-components).
 */

import { createContext, useContext } from 'react'

/** What the user picked. `system` follows the OS. */
export type ThemePreference = 'light' | 'dark' | 'system'
/** What is actually painted right now. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'awpb.theme'

export interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}

/** Read the stored preference, tolerating private mode and stale values. */
export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    /* storage unavailable - fall through to the default */
  }
  return 'system'
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
