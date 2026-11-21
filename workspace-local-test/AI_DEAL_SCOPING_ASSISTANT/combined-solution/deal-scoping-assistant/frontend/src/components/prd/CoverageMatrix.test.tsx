import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CoverageMatrix } from "@/components/prd/CoverageMatrix"
import { UnsupportedAdditions } from "@/components/prd/UnsupportedAdditions"
import { TestProviders } from "@/test/TestProviders"
import type { CoverageReport } from "@/api/types"

const report: CoverageReport = {
  rows: [
    {
      item_id: "FR_01",
      item_type: "FR",
      title: "Self-service renewals",
      priority: "must",
      status: "approved",
      counts_in_percentage: true,
      covered: true,
      cells: [
        { column: "prd", element_ids: ["FR_01"], covered: true },
        { column: "capability", element_ids: ["CAP_01"], covered: true },
      ],
    },
    {
      item_id: "NFR_01",
      item_type: "NFR",
      title: "Handle peak load",
      priority: "high",
      status: "approved",
      counts_in_percentage: true,
      covered: false,
      cells: [
        { column: "prd", element_ids: ["NFR_01"], covered: true },
        { column: "capability", element_ids: [], covered: false },
      ],
    },
  ],
  counted_count: 2,
  covered_count: 1,
  coverage_pct: 50,
  uncovered_ids: ["NFR_01"],
  high_priority_count: 2,
  high_priority_covered_count: 1,
  high_priority_pct: 50,
  high_priority_uncovered_ids: ["NFR_01"],
  unsupported_additions: [],
}

describe("CoverageMatrix", () => {
  it("renders one column per coverage column the API returned", () => {
    render(<CoverageMatrix report={report} onSelectId={vi.fn()} />, { wrapper: TestProviders })

    expect(screen.getByRole("columnheader", { name: "PRD" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Capability" })).toBeInTheDocument()
  })

  it("marks covered and uncovered cells", () => {
    render(<CoverageMatrix report={report} onSelectId={vi.fn()} />, { wrapper: TestProviders })

    expect(screen.getByLabelText("Covered in Capability by CAP_01")).toBeInTheDocument()
    expect(screen.getByLabelText("Not covered in Capability")).toBeInTheDocument()
  })
})

describe("UnsupportedAdditions", () => {
  it("shows nothing when every element is grounded", () => {
    const { container } = render(<UnsupportedAdditions additions={[]} />, {
      wrapper: TestProviders,
    })

    expect(container).toBeEmptyDOMElement()
  })

  it("calls out an element that references nothing approved", () => {
    render(
      <UnsupportedAdditions
        additions={[
          {
            artifact: "functional_scope",
            element_id: "CAP_07",
            element_kind: "capability",
            referenced_ids: [],
            reason: "It references no reviewed requirement.",
          },
        ]}
      />,
      { wrapper: TestProviders },
    )

    expect(
      screen.getByText(/1 scope addition without an approved requirement/i),
    ).toBeInTheDocument()
    expect(screen.getByText("CAP_07")).toBeInTheDocument()
    expect(screen.getByText("It references no reviewed requirement.")).toBeInTheDocument()
  })
})
