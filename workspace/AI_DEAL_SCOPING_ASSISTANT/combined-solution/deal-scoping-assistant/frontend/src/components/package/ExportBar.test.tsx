import { useImperativeHandle } from "react"
import type { Ref } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ExportBar } from "@/components/package/ExportBar"
import { TestProviders } from "@/test/TestProviders"
import type { DiagramViewHandle } from "@/components/shared/DiagramView"

const PNG = "data:image/png;base64,AAA"
const mutateAsync = vi.fn(async () => ({ blob: new Blob(), filename: "package.md" }))
const saveBlob = vi.fn()

vi.mock("@/api/hooks/package", () => ({
  useExportPackage: () => ({ mutateAsync, isError: false, error: null }),
}))

vi.mock("@/lib/download", () => ({ saveBlob: (file: unknown) => saveBlob(file) }))

// Each test decides how the off-screen copies answer: a PNG after a delay, or a failure.
const toPng = vi.fn<() => Promise<string>>(async () => PNG)

vi.mock("@/components/shared/DiagramView", () => ({
  DiagramView: ({ ref, title }: { ref?: Ref<DiagramViewHandle>; title: string }) => {
    useImperativeHandle(ref, () => ({ toPng }))
    return <figure aria-label={title} />
  },
}))

const diagrams = { architecture_mermaid: "graph TD; A-->B", integration_mermaid: "graph TD; C-->D" }

function renderBar(status: "ready" | "review_required" | "blocked") {
  return render(<ExportBar sessionId="s-1" status={status} diagrams={diagrams} />, {
    wrapper: TestProviders,
  })
}

describe("ExportBar", () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    saveBlob.mockClear()
    toPng.mockReset()
    toPng.mockImplementation(async () => PNG)
  })

  it("exports Markdown without any rendered image", async () => {
    renderBar("ready")

    await userEvent.click(screen.getByRole("button", { name: /export markdown/i }))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        format: "md",
        architecture_diagram_png: "",
        integration_diagram_png: "",
      }),
    )
    expect(saveBlob).toHaveBeenCalled()
  })

  it.each([
    [/export word document/i, "docx"],
    [/export pdf/i, "pdf"],
  ] as const)("sends both diagram PNGs for %s", async (name, format) => {
    renderBar("ready")

    await userEvent.click(screen.getByRole("button", { name }))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        format,
        architecture_diagram_png: PNG,
        integration_diagram_png: PNG,
      }),
    )
  })

  it("waits for a diagram that is still rendering instead of exporting without it", async () => {
    toPng.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(PNG), 50)))
    renderBar("ready")

    await userEvent.click(screen.getByRole("button", { name: /export pdf/i }))

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        format: "pdf",
        architecture_diagram_png: PNG,
        integration_diagram_png: PNG,
      }),
    )
  })

  it("shows the failure and sends nothing when a diagram image cannot be made", async () => {
    toPng.mockRejectedValue(new Error("The diagram could not be converted to an image."))
    renderBar("ready")

    await userEvent.click(screen.getByRole("button", { name: /export word document/i }))

    expect(await screen.findByText(/could not be converted/i)).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /export word document/i })).toBeEnabled()
  })

  it("disables every export while the package is blocked", () => {
    renderBar("blocked")

    for (const name of [/export markdown/i, /export word document/i, /export pdf/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled()
    }
    expect(screen.getByText(/a required output is missing/i)).toBeInTheDocument()
  })

  it("allows the export when a review is required and says so", () => {
    renderBar("review_required")

    expect(screen.getByRole("button", { name: /export pdf/i })).toBeEnabled()
    expect(screen.getByText(/quality gate asks for a review/i)).toBeInTheDocument()
  })
})
