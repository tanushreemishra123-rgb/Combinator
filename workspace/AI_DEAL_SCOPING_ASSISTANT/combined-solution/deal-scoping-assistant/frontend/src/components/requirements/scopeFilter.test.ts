import { describe, expect, it } from "vitest"
import { ALL_FILTERS, filterScopeItems } from "@/components/requirements/scopeFilter"
import { makeScopeItem } from "@/test/factories"

const items = [
  makeScopeItem({ id: "FR_01", priority: "must", status: "approved" }),
  makeScopeItem({ id: "NFR_01", type: "NFR", priority: "low", origin: "ai_inferred" }),
  makeScopeItem({ id: "ASM_01", type: "ASM", origin: "assumed", status: "rejected" }),
]

describe("filterScopeItems", () => {
  it("keeps everything with the default filters", () => {
    expect(filterScopeItems(items, ALL_FILTERS)).toHaveLength(3)
  })

  it("combines type, origin, priority and status filters", () => {
    expect(filterScopeItems(items, { ...ALL_FILTERS, type: "NFR" })).toHaveLength(1)
    expect(filterScopeItems(items, { ...ALL_FILTERS, origin: "assumed" })).toHaveLength(1)
    expect(filterScopeItems(items, { ...ALL_FILTERS, priority: "must" })).toHaveLength(1)
    expect(filterScopeItems(items, { ...ALL_FILTERS, status: "rejected" })).toHaveLength(1)
    expect(filterScopeItems(items, { ...ALL_FILTERS, type: "NFR", priority: "must" })).toHaveLength(
      0,
    )
  })

  it("ignores case and surrounding spaces in the search", () => {
    expect(filterScopeItems(items, { ...ALL_FILTERS, search: "  Asm_01 " })).toHaveLength(1)
  })
})
