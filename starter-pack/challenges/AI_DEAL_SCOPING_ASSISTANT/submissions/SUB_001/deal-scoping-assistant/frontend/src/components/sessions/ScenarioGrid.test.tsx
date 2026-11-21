import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { ScenarioGrid } from "@/components/sessions/ScenarioGrid"
import { makeSession } from "@/test/factories"
import type { Scenario, Session } from "@/api/types"

const scenario: Scenario = {
  slug: "legacy-policy-modernization",
  title: "Legacy policy modernization",
  scenario_type: "application_modernization",
  customer_name: "Northwind Insurance",
  industry: "Insurance",
  opportunity_summary: "Replace a mainframe policy system with a cloud platform.",
  requested_by: "Head of Operations",
  preferred_cloud: "azure",
  expected_users: 4000,
  target_regions: ["eu-west"],
  delivery_deadline: null,
  regulatory_constraints: ["GDPR"],
  demo_change: {
    description: "Add PCI-DSS",
    config_key: "regulatory_constraints",
    from: [],
    to: ["PCI-DSS"],
  },
}

const created = makeSession({ id: "session-9" })
const mutate = vi.fn((_slug: string, options?: { onSuccess?: (session: Session) => void }) =>
  options?.onSuccess?.(created),
)

vi.mock("@/api/hooks/scenarios", () => ({
  useScenarios: () => ({ data: [scenario], isPending: false, isError: false, error: null }),
  useCreateSessionFromScenario: () => ({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
  }),
}))

function Location() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

function renderGrid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="*" element={<ScenarioGrid />} />
        </Routes>
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("ScenarioGrid", () => {
  it("shows the title, type and summary of each sample scenario", () => {
    renderGrid()

    expect(screen.getByText("Legacy policy modernization")).toBeInTheDocument()
    expect(screen.getByText("Application modernization")).toBeInTheDocument()
    expect(
      screen.getByText("Replace a mainframe policy system with a cloud platform."),
    ).toBeInTheDocument()
  })

  it("creates a session from the scenario and opens its requirements workspace", async () => {
    renderGrid()

    await userEvent.click(screen.getByRole("button", { name: /start from this scenario/i }))

    expect(mutate).toHaveBeenCalledWith("legacy-policy-modernization", expect.anything())
    expect(await screen.findByTestId("path")).toHaveTextContent("/sessions/session-9/requirements")
  })
})
