import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OriginBadge } from "@/components/shared/OriginBadge"
import { PriorityBadge } from "@/components/shared/PriorityBadge"

describe("OriginBadge", () => {
  it.each([
    ["customer_stated", "Customer stated"],
    ["ai_inferred", "AI inferred"],
    ["assumed", "Assumed"],
  ] as const)("renders %s as %s", (origin, label) => {
    render(<OriginBadge origin={origin} />)

    expect(screen.getByLabelText(`Origin: ${label}`)).toHaveTextContent(label)
  })
})

describe("PriorityBadge", () => {
  it.each([
    ["must", "Must"],
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ] as const)("renders %s as %s", (priority, label) => {
    render(<PriorityBadge priority={priority} />)

    expect(screen.getByLabelText(`Priority: ${label}`)).toHaveTextContent(label)
  })
})
