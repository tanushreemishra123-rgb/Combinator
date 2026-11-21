import { describe, expect, it } from "vitest"
import { buildChangeRequest, validateChangeValues } from "@/components/package/changeKinds"
import type { ChangeFormValues } from "@/components/package/changeKinds"
import { makeSessionConfig } from "@/test/factories"

const config = makeSessionConfig({ contingency_pct: 15, expected_users: 5000 })

const values: ChangeFormValues = {
  note: "Customer confirmed on the call",
  itemId: "NFR_02",
  title: "Handle peak renewal load",
  description: "The portal must stay responsive during renewals.",
  priority: "must",
  status: "rejected",
  newItemType: "FR",
  newItemOrigin: "customer_stated",
  decision: "reject",
  answer: "About 500,000 policyholders.",
  platform: "gcp",
  expectedUsers: "500000",
  deadline: "2027-03-01",
  rateCardId: "premium",
  contingency: "25",
  securityLevel: "regulated",
  regulatory: "GDPR, PCI-DSS",
  aiProvider: "anthropic",
  unitId: "CAP_03",
  complexity: "high",
}

describe("buildChangeRequest", () => {
  it("builds a priority change that names the item", () => {
    const request = buildChangeRequest("requirement_priority", values, config)

    expect(request.change_type).toBe("scope_item_priority")
    expect(request.item_ids).toEqual(["NFR_02"])
    expect(request.item_update).toEqual({ priority: "must" })
    expect(request.description).toBe("Customer confirmed on the call")
  })

  it("builds an assumption decision carrying the reject", () => {
    const request = buildChangeRequest("assumption_decision", values, config)

    expect(request.change_type).toBe("assumption_decision")
    expect(request.confirmed).toBe(false)
    expect(request.item_ids).toEqual(["NFR_02"])
  })

  it("builds a question answer with the recorded text", () => {
    const request = buildChangeRequest("question_answered", values, config)

    expect(request.change_type).toBe("question_answered")
    expect(request.answer).toBe("About 500,000 policyholders.")
  })

  it("builds a platform change as a config change with the flag set", () => {
    const request = buildChangeRequest("cloud_platform", values, config)

    expect(request.change_type).toBe("config_change")
    expect(request.platform_change).toBe(true)
    expect(request.cloud_platform).toBe("gcp")
  })

  it("carries the untouched config forward when one input changes", () => {
    const request = buildChangeRequest("expected_users", values, config)

    expect(request.change_type).toBe("config_change")
    expect(request.config?.expected_users).toBe(500000)
    expect(request.config?.contingency_pct).toBe(15)
  })

  it("clears the expected volume when the field is emptied", () => {
    const request = buildChangeRequest("expected_users", { ...values, expectedUsers: "" }, config)

    expect(request.config?.expected_users).toBeNull()
  })

  it("splits the regulatory constraints into a list", () => {
    const request = buildChangeRequest("regulatory_constraints", values, config)

    expect(request.config?.regulatory_constraints).toEqual(["GDPR", "PCI-DSS"])
  })

  it("builds a unit complexity change", () => {
    const request = buildChangeRequest("unit_complexity", values, config)

    expect(request.change_type).toBe("unit_complexity")
    expect(request.unit_complexity).toEqual([{ unit_id: "CAP_03", complexity: "high" }])
  })

  it("adds a requirement with a complete create payload", () => {
    const request = buildChangeRequest("requirement_added", values, config)

    expect(request.change_type).toBe("scope_item_added")
    expect(request.item_create).toMatchObject({
      type: "FR",
      title: "Handle peak renewal load",
      origin: "customer_stated",
      priority: "must",
    })
  })
})

describe("buildChangeRequest rate card", () => {
  it("drops the old card's overrides when the card changes", () => {
    const priced = makeSessionConfig({
      rate_card_id: "usd-standard",
      rate_overrides: [{ role: "Solution Architect", rate_per_person_week: 9900 }],
    })

    const request = buildChangeRequest(
      "rate_card",
      { ...values, rateCardId: "eur-standard" },
      priced,
    )

    expect(request.config?.rate_card_id).toBe("eur-standard")
    expect(request.config?.rate_overrides).toEqual([])
  })
})

describe("validateChangeValues", () => {
  it("refuses an empty contingency instead of recording 0%", () => {
    expect(validateChangeValues("contingency", { ...values, contingency: "" })).toEqual({
      contingency: expect.stringMatching(/between 0 and 100/i),
    })
    expect(validateChangeValues("contingency", { ...values, contingency: "150" })).toHaveProperty(
      "contingency",
    )
    expect(validateChangeValues("contingency", values)).toEqual({})
  })

  it("requires the scope item id for item changes", () => {
    expect(validateChangeValues("requirement_priority", { ...values, itemId: " " })).toHaveProperty(
      "itemId",
    )
    expect(validateChangeValues("requirement_priority", values)).toEqual({})
  })

  it("lets the expected users stay empty but not be text", () => {
    expect(validateChangeValues("expected_users", { ...values, expectedUsers: "" })).toEqual({})
    expect(
      validateChangeValues("expected_users", { ...values, expectedUsers: "many" }),
    ).toHaveProperty("expectedUsers")
  })
})
