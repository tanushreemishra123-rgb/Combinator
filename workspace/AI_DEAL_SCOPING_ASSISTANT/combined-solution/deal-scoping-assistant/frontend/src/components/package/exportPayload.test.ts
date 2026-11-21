import { describe, expect, it } from "vitest"
import { buildExportRequest, needsDiagramImages } from "@/components/package/exportPayload"

const pngs = { architecture: "data:image/png;base64,AAA", integration: "data:image/png;base64,BBB" }

describe("needsDiagramImages", () => {
  it("only rasterises for the binary formats", () => {
    expect(needsDiagramImages("md")).toBe(false)
    expect(needsDiagramImages("docx")).toBe(true)
    expect(needsDiagramImages("pdf")).toBe(true)
  })
})

describe("buildExportRequest", () => {
  it("sends no images for Markdown, which embeds the Mermaid source", () => {
    expect(buildExportRequest("md", pngs)).toEqual({
      format: "md",
      architecture_diagram_png: "",
      integration_diagram_png: "",
    })
  })

  it.each(["docx", "pdf"] as const)("sends both PNG data URLs for %s", (format) => {
    expect(buildExportRequest(format, pngs)).toEqual({
      format,
      architecture_diagram_png: pngs.architecture,
      integration_diagram_png: pngs.integration,
    })
  })

  it("sends an empty string for a diagram that has not been rendered", () => {
    const request = buildExportRequest("pdf", { architecture: null, integration: null })

    expect(request.architecture_diagram_png).toBe("")
    expect(request.integration_diagram_png).toBe("")
  })
})
