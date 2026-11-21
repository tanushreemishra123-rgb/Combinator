import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ComponentAreas } from "@/components/architecture/ComponentAreas"
import { makeComponent } from "@/test/artifactFactories"
import { TestProviders } from "@/test/TestProviders"

const components = [
  makeComponent({ id: "ARC_01", area: "apis", name: "Policy API" }),
  makeComponent({ id: "ARC_02", area: "databases_and_storage", name: "Policy store" }),
  makeComponent({ id: "ARC_03", area: "apis", name: "Broker API" }),
]

describe("ComponentAreas", () => {
  it("groups components under the challenge's area names", () => {
    render(<ComponentAreas components={components} onSelectId={vi.fn()} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByRole("heading", { name: "APIs" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Databases and storage" })).toBeInTheDocument()
    expect(screen.getByText("Policy API")).toBeInTheDocument()
    expect(screen.getByText("Broker API")).toBeInTheDocument()
  })

  it("names the areas nothing covers instead of hiding them", () => {
    render(<ComponentAreas components={components} onSelectId={vi.fn()} />, {
      wrapper: TestProviders,
    })

    expect(screen.getByRole("heading", { name: "Areas with no component" })).toBeInTheDocument()
    expect(screen.getByText("User-facing applications")).toBeInTheDocument()
    expect(screen.getByText("Backup and disaster recovery")).toBeInTheDocument()
  })

  it("shows no missing-area list when every area is covered", () => {
    const all = [
      "user_facing_applications",
      "backend_services",
      "apis",
      "databases_and_storage",
      "identity_and_access_management",
      "messaging_and_event_processing",
      "integration_components",
      "ai_and_ml_services",
      "observability_and_monitoring",
      "security_controls",
      "deployment_and_runtime",
      "environments_dev_test_prod",
      "availability_and_scalability",
      "backup_and_disaster_recovery",
    ] as const

    render(
      <ComponentAreas
        components={all.map((area, index) => makeComponent({ id: `ARC_${index}`, area }))}
      />,
      { wrapper: TestProviders },
    )

    expect(
      screen.queryByRole("heading", { name: "Areas with no component" }),
    ).not.toBeInTheDocument()
  })
})
