import { describe, expect, it } from "vitest"
import { elementLabel } from "@/lib/labels"

describe("elementLabel", () => {
  it("keeps structured ids as they are", () => {
    expect(elementLabel("FR_01")).toBe("FR_01")
    expect(elementLabel("ARC_12")).toBe("ARC_12")
  })

  it("turns section names and indexed fields into plain words", () => {
    expect(elementLabel("deployment_runtime")).toBe("Deployment runtime")
    expect(elementLabel("key_risks[0]")).toBe("Key risks 1")
    expect(elementLabel("rom")).toBe("ROM")
  })

  it("leaves free text alone", () => {
    expect(elementLabel("Track a shipment")).toBe("Track a shipment")
  })
})
