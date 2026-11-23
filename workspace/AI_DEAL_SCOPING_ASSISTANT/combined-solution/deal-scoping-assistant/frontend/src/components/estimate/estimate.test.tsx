import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MissingInputsAlert } from "@/components/estimate/MissingInputsAlert"
import { complexityChangeRequest, editRoute } from "@/components/estimate/routing"
import { TraceTable } from "@/components/shared/TraceTable"
import { TestProviders } from "@/test/TestProviders"

describe("editRoute", () => {
  it("writes directly until the scope is approved", () => {
    expect(editRoute("empty")).toBe("direct")
    expect(editRoute("analyzed")).toBe("direct")
  })

  it("records a change once the scope is approved", () => {
    expect(editRoute("approved")).toBe("change_request")
  })
})

describe("complexity edits", () => {
  it("builds a unit-complexity change request", () => {
    const request = complexityChangeRequest("IA_02", "very_high")

    expect(request.change_type).toBe("unit_complexity")
    expect(request.unit_complexity).toEqual([{ unit_id: "IA_02", complexity: "very_high" }])
    expect(request.description).toContain("IA_02")
  })
})

describe("TraceTable", () => {
  it("shows the formula, the inputs and the result once opened", async () => {
    const { container } = render(
      <TraceTable
        entries={[
          {
            label: "Policy capability effort",
            formula: "base x factors",
            inputs: [
              { name: "base", value: "8" },
              { name: "security factor", value: "1.2" },
            ],
            result: 9.6,
          },
        ]}
      />,
      { wrapper: TestProviders },
    )

    screen.getByRole("button", { name: /show calculation/i }).click()
    await screen.findByText("base x factors")

    expect(screen.getByText("Policy capability effort")).toBeInTheDocument()
    expect(screen.getByText("base = 8")).toBeInTheDocument()
    expect(container.textContent).toContain("9.6")
  })

  it("renders nothing without a trace", () => {
    const { container } = render(<TraceTable entries={[]} />, { wrapper: TestProviders })

    expect(container).toBeEmptyDOMElement()
  })
})

describe("MissingInputsAlert", () => {
  it("names each gap, what it affects and every blocked line", () => {
    render(
      <MissingInputsAlert
        missing={[
          {
            key: "expected_users",
            impact: "Scalability sizing cannot be checked.",
            affected_components: ["ARC_02", "Testing"],
          },
        ]}
        blocked={[{ label: "Data workstream ROM", reason: "no rate for Data Engineer" }]}
      />,
      { wrapper: TestProviders },
    )

    expect(
      screen.getByText(/1 missing input and 1 line that cannot be calculated/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Scalability sizing cannot be checked/)).toBeInTheDocument()
    expect(screen.getByText(/Affects ARC_02, Testing/)).toBeInTheDocument()
    expect(screen.getByText(/no rate for Data Engineer/)).toBeInTheDocument()
  })

  it("stays quiet when nothing is missing", () => {
    const { container } = render(<MissingInputsAlert missing={[]} blocked={[]} />, {
      wrapper: TestProviders,
    })

    expect(container).toBeEmptyDOMElement()
  })
})
