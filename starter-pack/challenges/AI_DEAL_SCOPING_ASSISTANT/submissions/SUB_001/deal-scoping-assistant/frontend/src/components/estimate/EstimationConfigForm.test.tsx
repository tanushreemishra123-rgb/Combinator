import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EstimationConfigForm } from "@/components/estimate/EstimationConfigForm"
import { makeSessionConfig } from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"
import type { RateCard, TeamSizeEntry } from "@/api/types"

const save = vi.fn()
vi.mock("@/api/hooks/estimate", () => ({
  useSaveEstimationConfig: () => ({ mutateAsync: save, isError: false, error: null }),
}))
vi.mock("@/api/hooks/changes", () => ({
  useRecordChange: () => ({ mutateAsync: vi.fn(), isError: false, error: null }),
}))

const rateCards: RateCard[] = [
  {
    id: "usd-standard",
    name: "USD standard",
    currency: "USD",
    rates: [
      { role: "Backend Engineer", rate_per_person_week: 7600 },
      { role: "QA Engineer", rate_per_person_week: 6400 },
    ],
  },
]

const config = makeSessionConfig({ rate_card_id: "usd-standard" })

// What GET /estimation-config returns: the rule defaults, no session override yet.
const teamSizes: TeamSizeEntry[] = [
  { workstream_type: "application", team_size: 5 },
  { workstream_type: "data", team_size: 3 },
]

function renderForm(scopeStatus: "analyzed" | "approved" = "analyzed") {
  return render(
    <EstimationConfigForm
      sessionId="s-1"
      config={config}
      rateCards={rateCards}
      teamSizes={teamSizes}
      scopeStatus={scopeStatus}
    />,
    { wrapper: TestProviders },
  )
}

describe("EstimationConfigForm", () => {
  it("groups the inputs into the four sections", () => {
    renderForm()

    for (const title of [/commercials/i, /delivery/i, /customer context/i, /^team$/i]) {
      expect(screen.getByRole("group", { name: title })).toBeInTheDocument()
    }
  })

  it("renders every estimation input the engine reads", () => {
    renderForm()

    for (const name of [
      /rate card/i,
      /contingency/i,
      /security level/i,
      /testing level/i,
      /environments/i,
      /data migration/i,
      /expected users/i,
      /delivery date/i,
      /ai provider/i,
      /target regions/i,
      /regulatory constraints/i,
      /productivity factor/i,
      /working weeks per month/i,
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
    // Team sizes are a compact table, one row per workstream type, at its default.
    expect(screen.getByRole("columnheader", { name: /workstream type/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/application/i)).toHaveValue(5)
    expect(screen.getByLabelText(/^data$/i)).toHaveValue(3)
  })

  it("keeps helper text only where it states a rule", () => {
    renderForm()

    expect(screen.getByText("Leave empty if the customer has not said.")).toBeInTheDocument()
    expect(screen.getAllByText("Comma separated.")).toHaveLength(2)
    expect(screen.getByText(/one productive person-week/i)).toBeInTheDocument()
  })

  it("sends only the role rates that differ from the card as session overrides", async () => {
    const user = userEvent.setup()
    renderForm()

    const backend = screen.getByLabelText("Backend Engineer")
    expect(backend).toHaveValue(7600)
    await user.clear(backend)
    await user.type(backend, "9000")
    expect(screen.getByText("was 7,600")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /save inputs/i }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0].rate_overrides).toEqual([
      { role: "Backend Engineer", rate_per_person_week: 9000 },
    ])
  })

  it("sends the edited team size with the rest of the rows", async () => {
    const user = userEvent.setup()
    renderForm()

    const application = screen.getByLabelText(/application/i)
    await user.clear(application)
    await user.type(application, "8")

    await user.click(screen.getByRole("button", { name: /save inputs/i }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0].team_sizes).toEqual([
      { workstream_type: "application", team_size: 8 },
      { workstream_type: "data", team_size: 3 },
    ])
  })

  it("says the save will be recorded as a change once the scope is approved", () => {
    renderForm("approved")

    expect(screen.getByRole("button", { name: /save inputs/i })).toBeInTheDocument()
    expect(screen.getByText(/records a configuration change/i)).toBeInTheDocument()
  })
})
