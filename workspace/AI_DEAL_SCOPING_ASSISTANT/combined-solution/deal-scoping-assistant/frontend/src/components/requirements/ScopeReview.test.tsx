import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ScopeReview } from "@/components/requirements/ScopeReview"
import { makeScopeItem, makeScopeView } from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"

vi.mock("@/api/hooks/scope", () => ({
  useCreateScopeItem: () => ({ mutateAsync: vi.fn(), isError: false, error: null }),
}))

const scope = makeScopeView([
  makeScopeItem({ id: "FR_01", title: "Self-service renewals", priority: "must" }),
  makeScopeItem({
    id: "NFR_01",
    type: "NFR",
    title: "Handle 5,000 concurrent users",
    priority: "medium",
    origin: "ai_inferred",
  }),
  makeScopeItem({
    id: "ASM_01",
    type: "ASM",
    title: "Single language at launch",
    origin: "assumed",
    status: "rejected",
  }),
])

function renderReview() {
  return render(
    <ScopeReview sessionId="session-1" scope={scope} locked={false} onSelect={vi.fn()} />,
    { wrapper: TestProviders },
  )
}

describe("ScopeReview", () => {
  it("lists every scope item with its id", () => {
    renderReview()

    expect(screen.getByText("FR_01")).toBeInTheDocument()
    expect(screen.getByText("NFR_01")).toBeInTheDocument()
    expect(screen.getByText("ASM_01")).toBeInTheDocument()
  })

  it("filters by free text across ids and titles", async () => {
    renderReview()

    await userEvent.type(screen.getByLabelText("Search the scope"), "concurrent")

    expect(screen.getByText("NFR_01")).toBeInTheDocument()
    expect(screen.queryByText("FR_01")).not.toBeInTheDocument()
    expect(screen.queryByText("ASM_01")).not.toBeInTheDocument()
  })

  it("finds an item by its id", async () => {
    renderReview()

    await userEvent.type(screen.getByLabelText("Search the scope"), "asm_0")

    expect(screen.getByText("ASM_01")).toBeInTheDocument()
    expect(screen.queryByText("NFR_01")).not.toBeInTheDocument()
  })

  it("opens the item that was clicked", async () => {
    const onSelect = vi.fn()
    render(<ScopeReview sessionId="session-1" scope={scope} locked onSelect={onSelect} />, {
      wrapper: TestProviders,
    })

    await userEvent.click(screen.getByText("Self-service renewals"))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "FR_01" }))
  })
})
