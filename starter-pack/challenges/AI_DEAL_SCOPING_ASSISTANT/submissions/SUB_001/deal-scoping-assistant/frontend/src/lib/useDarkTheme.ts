import { useEffect, useState } from "react"

function isDark(): boolean {
  return document.documentElement.classList.contains("dark")
}

/** True while the root element carries the `dark` class; updates when the theme toggles. */
export function useDarkTheme(): boolean {
  const [dark, setDark] = useState(isDark)
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return dark
}
