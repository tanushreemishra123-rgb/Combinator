import { useEffect, useState } from "react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { applyTheme, isTheme, prefersDark, readTheme, storeTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"

const OPTIONS: readonly { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "Follow the system", Icon: MonitorIcon },
]

/** Theme choice as radio items; lives inside the sidebar footer menu. */
export function ThemeMenu() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
    storeTheme(theme)
    if (theme !== "system") return
    // Keep following the OS while "system" is selected.
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const follow = () => applyTheme(prefersDark() ? "dark" : "light")
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [theme])

  return (
    <>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => {
          if (isTheme(value)) setTheme(value)
        }}
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            <Icon />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}
