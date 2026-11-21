import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DiagramView } from "@/components/shared/DiagramView"
import type { DiagramViewHandle } from "@/components/shared/DiagramView"

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>'
const renderMermaid = vi.fn<(id: string, source: string, theme?: string) => Promise<string>>()

vi.mock("@/lib/mermaid", () => ({
  renderMermaid: (id: string, source: string, theme?: string) => renderMermaid(id, source, theme),
  parseSvg: () => document.createElementNS("http://www.w3.org/2000/svg", "svg"),
  svgToPngDataUrl: async (svg: string) => `png:${svg.length}`,
}))

describe("DiagramView", () => {
  it("answers toPng once the render finishes, even when asked before it does", async () => {
    let finish: (svg: string) => void = () => {}
    renderMermaid.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const ref = createRef<DiagramViewHandle>()
    render(<DiagramView ref={ref} source="graph TD; A-->B" title="Test diagram" />)

    const png = ref.current?.toPng()
    finish(SVG)

    await expect(png).resolves.toBe(`png:${SVG.length}`)
  })

  it("rejects toPng when the source cannot be rendered", async () => {
    renderMermaid.mockRejectedValue(new Error("bad source"))
    const ref = createRef<DiagramViewHandle>()
    render(<DiagramView ref={ref} source="nonsense" title="Broken diagram" />)

    await expect(ref.current?.toPng()).rejects.toThrow("bad source")
    expect(await screen.findByText(/bad source/)).toBeInTheDocument()
  })

  it("renders export copies with the light theme whatever the app theme", async () => {
    document.documentElement.classList.add("dark")
    renderMermaid.mockResolvedValue(SVG)
    render(<DiagramView source="graph TD; A-->B" title="Export copy" theme="light" />)

    expect(await screen.findByRole("img", { name: "Export copy" })).toBeInTheDocument()
    expect(renderMermaid).toHaveBeenLastCalledWith(expect.any(String), "graph TD; A-->B", "light")
    document.documentElement.classList.remove("dark")
  })
})
