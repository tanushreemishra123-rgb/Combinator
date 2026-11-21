import { describe, expect, it } from "vitest"
import {
  platformGenerateOptions,
  platformSelectorState,
} from "@/components/architecture/platformRules"

describe("platformSelectorState", () => {
  it("saves the choice on the session while the scope is still open", () => {
    const state = platformSelectorState({
      cloud_platform: null,
      platform_mode: "selected",
      scope_status: "analyzed",
    })

    expect(state.mode).toBe("session")
    expect(state.note).toBeNull()
  })

  it("reports the recommendation as the current choice", () => {
    const state = platformSelectorState({
      cloud_platform: null,
      platform_mode: "recommended",
      scope_status: "empty",
    })

    expect(state.selected).toBe("recommend")
  })

  it("defers to the generate call once the scope is approved with no platform", () => {
    const state = platformSelectorState({
      cloud_platform: null,
      platform_mode: "selected",
      scope_status: "approved",
    })

    expect(state.mode).toBe("generate")
    expect(state.note).toMatch(/first architecture generation/i)
  })

  it("requires a recorded change to swap an approved platform", () => {
    const state = platformSelectorState({
      cloud_platform: "azure",
      platform_mode: "selected",
      scope_status: "approved",
    })

    expect(state.mode).toBe("change_request")
    expect(state.selected).toBe("azure")
    expect(state.note).toMatch(/recorded change/i)
  })
})

describe("platformGenerateOptions", () => {
  it("asks for a recommendation", () => {
    expect(platformGenerateOptions("recommend", null)).toEqual({ recommend: true })
  })

  it("names the chosen platform", () => {
    expect(platformGenerateOptions("gcp", null)).toEqual({ platform: "gcp", recommend: false })
  })

  it("sends nothing but the default when no choice was made", () => {
    expect(platformGenerateOptions(null, null)).toEqual({ recommend: false })
  })

  it("regenerates for the session's platform even if 'recommend' was chosen earlier", () => {
    expect(platformGenerateOptions("recommend", "aws")).toEqual({
      platform: "aws",
      recommend: false,
    })
  })
})
