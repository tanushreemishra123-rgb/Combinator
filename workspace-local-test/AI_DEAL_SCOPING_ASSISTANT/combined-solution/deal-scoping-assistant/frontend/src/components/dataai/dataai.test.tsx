import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProcessingClassBadge } from "@/components/dataai/ProcessingClassBadge"
import { providersForPlatform } from "@/components/dataai/providerFilter"
import { serviceNames } from "@/components/dataai/arcServices"
import { makeComponent } from "@/test/artifactFactories"
import { TestProviders } from "@/test/TestProviders"
import type { ProviderOption } from "@/api/types"

describe("ProcessingClassBadge", () => {
  it.each([
    ["ai", "AI"],
    ["deterministic", "Deterministic rule"],
    ["human_decision", "Human decision"],
  ] as const)("renders %s as %s", (processing, text) => {
    render(<ProcessingClassBadge processing={processing} />, { wrapper: TestProviders })

    expect(screen.getByLabelText(`Processing: ${text}`)).toHaveTextContent(text)
  })
})

const options: ProviderOption[] = [
  { platform: "aws", provider: "Amazon Bedrock", models: ["Claude"], rationale: "Native." },
  { platform: "azure", provider: "Azure OpenAI", models: ["GPT"], rationale: "Native." },
  { platform: "any", provider: "Self-hosted", models: ["Llama"], rationale: "Portable." },
]

describe("providersForPlatform", () => {
  it("keeps the selected platform and the platform-independent options", () => {
    expect(providersForPlatform(options, "aws").map((option) => option.provider)).toEqual([
      "Amazon Bedrock",
      "Self-hosted",
    ])
  })

  it("keeps everything when no platform has been chosen", () => {
    expect(providersForPlatform(options, null)).toHaveLength(3)
  })
})

describe("serviceNames", () => {
  it("resolves architecture ids to the current platform's services", () => {
    const components = [
      makeComponent({ id: "ARC_01", cloud_service: "Azure Blob Storage" }),
      makeComponent({ id: "ARC_02", cloud_service: "Azure SQL" }),
    ]

    expect(serviceNames(components, ["ARC_02", "ARC_01", "ARC_99"])).toEqual([
      "Azure SQL",
      "Azure Blob Storage",
    ])
  })

  it("returns nothing while there is no architecture", () => {
    expect(serviceNames(undefined, ["ARC_01"])).toEqual([])
  })
})
