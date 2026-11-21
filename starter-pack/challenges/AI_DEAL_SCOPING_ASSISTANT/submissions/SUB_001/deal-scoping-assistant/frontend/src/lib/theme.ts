export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "deal-scoping-theme"
const THEMES: readonly Theme[] = ["light", "dark", "system"]
// Dark until the viewer picks otherwise; the toggle still offers light and system.
const DEFAULT_THEME: Theme = "dark"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
}

/** The stored preference; storage can be blocked, so a failure just means the default. */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A per-viewer convenience only; nothing depends on it being saved.
  }
}

export function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Tailwind's dark variant keys off the `dark` class on the root element. */
export function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && prefersDark())
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}
