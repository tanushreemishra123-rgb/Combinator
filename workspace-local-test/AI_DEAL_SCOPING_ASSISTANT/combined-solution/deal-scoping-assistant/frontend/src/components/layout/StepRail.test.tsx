import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { StepRail } from "@/components/layout/StepRail"
import { WORKSPACE_STEPS } from "@/components/layout/steps"

function renderRail(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StepRail
        sessionId="s-1"
        statuses={
          new Map([
            ["requirements", "approved"],
            ["prd-scope", "stale"],
            ["architecture", "ready"],
          ] as const)
        }
      />
    </MemoryRouter>,
  )
}

describe("StepRail", () => {
  it("lists the six workspaces", () => {
    renderRail("/sessions/s-1/requirements")

    expect(screen.getAllByRole("link")).toHaveLength(WORKSPACE_STEPS.length)
    expect(screen.getByText("Requirements")).toBeInTheDocument()
    expect(screen.getByText("Package")).toBeInTheDocument()
  })

  it("marks a finished step with a check instead of its number", () => {
    const { container } = renderRail("/sessions/s-1/requirements")

    // "approved" and "done" both count as finished.
    expect(screen.getByLabelText("Status: Approved").querySelector("svg")).toBeInTheDocument()
    expect(container.textContent).toContain("2")
  })

  it("marks the active step", () => {
    renderRail("/sessions/s-1/architecture")

    const active = screen.getByRole("link", { current: "page" })
    expect(active).toHaveTextContent("Architecture")
    expect(active).toHaveAttribute("href", "/sessions/s-1/architecture")
  })

  it("shows the status passed for each step and defaults the rest to not started", () => {
    renderRail("/sessions/s-1/requirements")

    expect(screen.getByLabelText("Status: Approved")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Stale")).toBeInTheDocument()
    expect(screen.getByLabelText("Status: Ready")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Status: Not started")).toHaveLength(3)
  })
})
