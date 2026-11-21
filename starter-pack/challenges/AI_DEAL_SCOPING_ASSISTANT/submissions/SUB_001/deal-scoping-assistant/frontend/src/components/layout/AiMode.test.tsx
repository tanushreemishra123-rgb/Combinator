import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AiModeNotice } from "@/components/layout/AiModeNotice"
import { SidebarFooter } from "@/components/layout/SidebarFooter"
import { makeSystemInfo } from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"

const user = userEvent.setup()

// Radix opens the menu on Enter as well as on click; the keyboard path is stable in jsdom.
async function openSettings() {
  screen.getByRole("button", { name: "Settings" }).focus()
  await user.keyboard("{Enter}")
}

describe("SidebarFooter", () => {
  it("names mock mode and explains it in the menu", async () => {
    render(<SidebarFooter system={makeSystemInfo()} />, { wrapper: TestProviders })

    expect(screen.getByText("Mock mode")).toBeInTheDocument()
    expect(screen.getByText("Recorded responses")).toBeInTheDocument()

    await openSettings()

    expect(await screen.findByText("Mock (recorded responses)")).toBeInTheDocument()
    expect(screen.getByText(/no customer text leaves this machine/i)).toBeInTheDocument()
    expect(screen.getByRole("menuitemradio", { name: /dark/i })).toBeInTheDocument()
  })

  it("names the provider and model in live mode", () => {
    render(
      <SidebarFooter
        system={makeSystemInfo({
          ai_mode: "live",
          provider: "anthropic",
          model: "claude-sonnet-4",
          live_available: true,
        })}
      />,
      { wrapper: TestProviders },
    )

    expect(screen.getByText("Live AI")).toBeInTheDocument()
    expect(screen.getByText("anthropic / claude-sonnet-4")).toBeInTheDocument()
  })

  it("shows the fallback reason in the menu", async () => {
    render(
      <SidebarFooter system={makeSystemInfo({ fallback_reason: "no API key is configured" })} />,
      {
        wrapper: TestProviders,
      },
    )

    await openSettings()

    expect(await screen.findByText(/no API key is configured/i)).toBeInTheDocument()
  })
})

describe("AiModeNotice", () => {
  it("warns that customer text leaves the machine in live mode", () => {
    render(
      <AiModeNotice
        system={makeSystemInfo({ ai_mode: "live", provider: "anthropic", model: "claude" })}
      />,
      { wrapper: TestProviders },
    )

    expect(screen.getByText(/customer text from this session is sent to/i)).toBeInTheDocument()
  })

  it("shows the fallback reason when live was requested but unavailable", () => {
    render(<AiModeNotice system={makeSystemInfo({ fallback_reason: "the key is missing" })} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByText(/the key is missing/i)).toBeInTheDocument()
  })

  it("stays quiet in plain mock mode", () => {
    const { container } = render(<AiModeNotice system={makeSystemInfo()} />, {
      wrapper: TestProviders,
    })

    expect(container).toBeEmptyDOMElement()
  })
})
