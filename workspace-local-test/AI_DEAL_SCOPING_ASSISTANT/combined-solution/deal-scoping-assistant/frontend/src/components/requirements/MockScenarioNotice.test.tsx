import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MockScenarioNotice } from "@/components/requirements/MockScenarioNotice"
import { makeSystemInfo } from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"

describe("MockScenarioNotice", () => {
  it("warns a mock-mode session that did not start from a sample scenario", () => {
    render(<MockScenarioNotice system={makeSystemInfo()} session={{ scenario_slug: "" }} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByText(/sample scenarios only/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /start from a sample scenario/i })).toHaveAttribute(
      "href",
      "/scenarios",
    )
  })

  it("stays quiet for a scenario session or in live mode", () => {
    const { container, rerender } = render(
      <MockScenarioNotice
        system={makeSystemInfo()}
        session={{ scenario_slug: "vague-portal-rfp" }}
      />,
      { wrapper: TestProviders },
    )
    expect(container).toBeEmptyDOMElement()

    rerender(
      <MockScenarioNotice
        system={makeSystemInfo({ ai_mode: "live", live_available: true })}
        session={{ scenario_slug: "" }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
