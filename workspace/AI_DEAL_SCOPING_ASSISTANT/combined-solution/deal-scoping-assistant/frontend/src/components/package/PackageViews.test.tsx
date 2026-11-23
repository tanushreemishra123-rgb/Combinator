import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChangeRecordView } from "@/components/package/ChangeRecordView"
import { CheckList } from "@/components/package/CheckList"
import { PackagePreview } from "@/components/package/PackagePreview"
import { QualitySummaryTiles } from "@/components/package/QualitySummaryTiles"
import {
  makeBlock,
  makeChangeRecord,
  makeCheck,
  makeDocument,
  makeQualityReport,
} from "@/test/artifactFactories"
import { TestProviders } from "@/test/TestProviders"

vi.mock("@/api/hooks/changes", () => ({
  useRegenerateAfterChange: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}))

vi.mock("@/components/shared/DiagramView", () => ({
  DiagramView: ({ title }: { title: string }) => <figure aria-label={title} />,
}))

describe("ChangeRecordView", () => {
  it("shows the affected outputs with their action, and what stays as reviewed", () => {
    render(<ChangeRecordView sessionId="s-1" record={makeChangeRecord()} onSelectId={vi.fn()} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByText("Configuration changed")).toBeInTheDocument()
    // Once as the affected output, once in the "now out of date" badges.
    expect(screen.getAllByText("Architecture")).toHaveLength(2)
    expect(screen.getByText("Regenerate")).toBeInTheDocument()
    expect(screen.getByText("ARC_02")).toBeInTheDocument()
    expect(screen.getByText("NFR_02")).toBeInTheDocument()
    expect(screen.getByText("Customer personas")).toBeInTheDocument()
    expect(screen.getByText("Existing CRM integration")).toBeInTheDocument()
  })

  it("cannot regenerate when nothing went stale", () => {
    render(<ChangeRecordView sessionId="s-1" record={makeChangeRecord({ stale_kinds: [] })} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByRole("button", { name: /regenerate affected outputs/i })).toBeDisabled()
  })
})

describe("Quality gate views", () => {
  it("shows the summary tiles the spec asks for", () => {
    render(<QualitySummaryTiles summary={makeQualityReport().summary} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByText("92%")).toBeInTheDocument()
    expect(screen.getByText("Unresolved questions")).toBeInTheDocument()
    expect(screen.getByText("Review required")).toBeInTheDocument()
    expect(screen.getByText("Medium")).toBeInTheDocument()
  })

  it("lists each check with its status, ids and remediation", () => {
    render(
      <CheckList
        checks={[
          makeCheck({ id: "QG_01" }),
          makeCheck({
            id: "QG_02",
            name: "Uncovered requirements",
            status: "failed",
            message: "NFR_04 is covered by nothing.",
            affected_ids: ["NFR_04"],
            remediation: "Cover it, or mark it out of scope.",
          }),
        ]}
        onSelectId={vi.fn()}
      />,
      { wrapper: TestProviders },
    )

    expect(screen.getByLabelText("Status: Passed")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Failed")).toBeInTheDocument()
    expect(screen.getByText("NFR_04")).toBeInTheDocument()
    expect(screen.getByText(/Cover it, or mark it out of scope/)).toBeInTheDocument()
  })
})

describe("PackagePreview", () => {
  const document = makeDocument({
    sections: [
      {
        id: "overview",
        title: "Executive summary",
        blocks: [
          makeBlock({ type: "heading", text: "Overview", level: 2 }),
          makeBlock({ type: "paragraph", text: "A modernised policy platform." }),
          makeBlock({
            type: "bullet_list",
            items: ["Exit the data centre", "Self-service portal"],
          }),
          makeBlock({
            type: "table",
            headers: ["Workstream", "Effort"],
            rows: [["Data and integration", "18–24"]],
          }),
          makeBlock({ type: "image", image_ref: "architecture_diagram", text: "Architecture" }),
          makeBlock({ type: "code", language: "json", text: "{}" }),
        ],
      },
    ],
  })

  const diagrams = { architecture_mermaid: "graph TD; A-->B", integration_mermaid: "" }

  it("renders every block type", () => {
    render(<PackagePreview document={document} diagrams={diagrams} />, { wrapper: TestProviders })

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(screen.getByText("A modernised policy platform.")).toBeInTheDocument()
    expect(screen.getByText("Exit the data centre")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Workstream" })).toBeInTheDocument()
    expect(screen.getByLabelText("Architecture")).toBeInTheDocument()
    expect(screen.getByText("{}")).toBeInTheDocument()
  })

  it("prints the required disclaimer above and below the package", () => {
    const { container } = render(<PackagePreview document={document} diagrams={diagrams} />, {
      wrapper: TestProviders,
    })

    const notices = within(container).getAllByText(document.disclaimer)
    expect(notices).toHaveLength(2)
  })

  it("draws a diagram once, from the image block, not again from its mermaid source", () => {
    const withSource = makeDocument({
      sections: [
        {
          id: "diagram",
          title: "Architecture diagram",
          blocks: [
            makeBlock({ type: "code", language: "mermaid", text: "graph TD; A-->B" }),
            makeBlock({ type: "image", image_ref: "architecture_diagram", text: "Figure 1" }),
          ],
        },
      ],
    })

    render(<PackagePreview document={withSource} diagrams={diagrams} />, {
      wrapper: TestProviders,
    })

    expect(screen.getAllByRole("figure")).toHaveLength(1)
    expect(screen.getByLabelText("Figure 1")).toBeInTheDocument()
  })

  it("falls back to a note when a diagram has not been generated", () => {
    render(
      <PackagePreview
        document={document}
        diagrams={{ architecture_mermaid: "", integration_mermaid: "" }}
      />,
      { wrapper: TestProviders },
    )

    expect(screen.getByText(/Architecture — not generated yet/)).toBeInTheDocument()
  })
})
