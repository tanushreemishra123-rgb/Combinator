import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SectionCard } from "@/components/shared/SectionCard"

/** The body stays mounted, so its state is read from the wrapper, not from presence. */
function body(): HTMLElement {
  return screen.getByText("Body text").closest("[data-slot=section-body]") as HTMLElement
}

describe("SectionCard", () => {
  it("starts open and folds its body away from the chevron or the header", async () => {
    render(
      <SectionCard
        title="Quality gate"
        description="Sixteen checks."
        actions={<button>Run</button>}
      >
        <p>Body text</p>
      </SectionCard>,
    )
    expect(screen.getByText("Body text")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Collapse section" }))
    expect(body()).toHaveAttribute("data-state", "closed")
    expect(body()).toHaveAttribute("inert")

    await userEvent.click(screen.getByText("Quality gate"))
    expect(body()).toHaveAttribute("data-state", "open")
    expect(body()).not.toHaveAttribute("inert")
  })

  it("leaves header actions alone", async () => {
    render(
      <SectionCard title="Customer input" actions={<button>Edit input</button>}>
        <p>Body text</p>
      </SectionCard>,
    )

    await userEvent.click(screen.getByRole("button", { name: "Edit input" }))

    expect(screen.getByText("Body text")).toBeInTheDocument()
  })

  it("remembers the state of a card on the same page", async () => {
    const { unmount } = render(
      <SectionCard title="Change history">
        <p>Body text</p>
      </SectionCard>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Collapse section" }))
    unmount()

    render(
      <SectionCard title="Change history">
        <p>Body text</p>
      </SectionCard>,
    )

    expect(body()).toHaveAttribute("data-state", "closed")
    expect(screen.getByRole("button", { name: "Expand section" })).toBeInTheDocument()
  })
})
