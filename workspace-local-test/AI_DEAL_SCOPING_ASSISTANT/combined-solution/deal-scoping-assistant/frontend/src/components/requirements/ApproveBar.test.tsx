import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ApproveBar } from "@/components/requirements/ApproveBar"
import {
  makeDetails,
  makeGapDetails,
  makeQuestionDetails,
  makeScopeItem,
  makeScopeView,
} from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"
import type { ScopeView } from "@/api/types"

vi.mock("@/api/hooks/scope", () => ({
  useApproveScope: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}))

function renderBar(scope: ScopeView | undefined) {
  return render(<ApproveBar sessionId="session-1" scope={scope} onSelectId={vi.fn()} />, {
    wrapper: TestProviders,
  })
}

const approveButton = () => screen.getByRole("button", { name: "Approve scope" })

describe("ApproveBar", () => {
  it("cannot approve an empty scope", () => {
    renderBar(makeScopeView([]))

    expect(approveButton()).toBeDisabled()
    expect(screen.getByText("Run the requirement analysis before approving.")).toBeInTheDocument()
  })

  it("cannot approve twice", () => {
    renderBar(makeScopeView([makeScopeItem({ id: "FR_01" })], { locked: true }))

    expect(approveButton()).toBeDisabled()
    expect(screen.getByText("This scope is already approved.")).toBeInTheDocument()
  })

  it("enables approval once the scope has items and shows the counts", () => {
    renderBar(
      makeScopeView([
        makeScopeItem({ id: "FR_01", status: "approved" }),
        makeScopeItem({ id: "FR_02", status: "rejected" }),
      ]),
    )

    expect(approveButton()).toBeEnabled()
    expect(screen.getByText("2 items")).toBeInTheDocument()
    expect(screen.getByText("Approved: 1")).toBeInTheDocument()
    expect(screen.getByText("Rejected: 1")).toBeInTheDocument()
  })

  it("warns about an open question raised for a critical gap without blocking approval", () => {
    const scope = makeScopeView([
      makeScopeItem({ id: "FR_01" }),
      makeScopeItem({
        id: "GAP_01",
        type: "GAP",
        title: "No volume figures",
        details: makeDetails({ gap: makeGapDetails({ criticality: "high", question_id: "Q_01" }) }),
      }),
      makeScopeItem({
        id: "Q_01",
        type: "Q",
        title: "How many users?",
        details: makeDetails({ question: makeQuestionDetails() }),
      }),
    ])

    renderBar(scope)

    expect(screen.getByText(/1 critical question is still open/i)).toBeInTheDocument()
    expect(approveButton()).toBeEnabled()
  })

  it("drops the warning once the question is answered", () => {
    const scope = makeScopeView([
      makeScopeItem({ id: "FR_01" }),
      makeScopeItem({
        id: "GAP_01",
        type: "GAP",
        details: makeDetails({ gap: makeGapDetails({ criticality: "high", question_id: "Q_01" }) }),
      }),
      makeScopeItem({
        id: "Q_01",
        type: "Q",
        details: makeDetails({
          question: makeQuestionDetails({ answer_status: "answered", answer: "About 5,000." }),
        }),
      }),
    ])

    renderBar(scope)

    expect(screen.queryByText(/critical question/i)).not.toBeInTheDocument()
  })
})
