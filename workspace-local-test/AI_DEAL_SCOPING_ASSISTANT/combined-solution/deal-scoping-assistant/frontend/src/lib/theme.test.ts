import { beforeEach, describe, expect, it } from "vitest"
import { applyTheme, isTheme, readTheme, storeTheme } from "@/lib/theme"

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("falls back to dark when nothing valid is stored", () => {
    expect(readTheme()).toBe("dark")
    window.localStorage.setItem("deal-scoping-theme", "purple")
    expect(readTheme()).toBe("dark")
  })

  it("round-trips a stored preference", () => {
    storeTheme("dark")
    expect(readTheme()).toBe("dark")
    expect(isTheme("light")).toBe(true)
    expect(isTheme("blue")).toBe(false)
  })

  it("toggles the dark class on the root element", () => {
    applyTheme("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    applyTheme("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
