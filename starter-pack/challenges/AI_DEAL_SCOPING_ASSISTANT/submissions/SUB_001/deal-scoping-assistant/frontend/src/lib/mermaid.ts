type Mermaid = typeof import("mermaid").default

let instance: Promise<Mermaid> | null = null

// Mermaid is large, so it is loaded only when the first diagram renders.
function loadMermaid(): Promise<Mermaid> {
  instance ??= import("mermaid").then(({ default: mermaid }) => mermaid)
  return instance
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark")
}

export type DiagramTheme = "app" | "light"

// Re-applied before every render so a theme switch is picked up by the next diagram.
function configure(mermaid: Mermaid, theme: DiagramTheme): void {
  mermaid.initialize({
    startOnLoad: false,
    // Diagram sources are model-generated, so scripts, click handlers and raw HTML must be stripped.
    securityLevel: "strict",
    // Exports are painted onto white paper, so they never use the dark theme.
    theme: theme === "app" && isDarkTheme() ? "dark" : "neutral",
    fontFamily: "inherit",
    // Plain SVG text labels: HTML labels are not valid XML and do not survive the
    // conversion to PNG that the DOCX and PDF exports need.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  })
}

// React ids contain characters that are illegal in the CSS selectors mermaid builds.
function safeId(id: string): string {
  return `mermaid-${id.replace(/[^a-zA-Z0-9-]/g, "")}`
}

// Mermaid's configuration is global, so renders run one at a time: an export copy
// asking for the light theme must not restyle a preview diagram rendering at the same moment.
let queue: Promise<unknown> = Promise.resolve()

// Rejects on invalid source so callers can show an error state instead of a broken diagram.
export function renderMermaid(
  id: string,
  source: string,
  theme: DiagramTheme = "app",
): Promise<string> {
  const run = queue.then(async () => {
    const mermaid = await loadMermaid()
    configure(mermaid, theme)
    await mermaid.parse(source)
    const { svg } = await mermaid.render(safeId(id), source)
    parseSvg(svg) // reject here, so the caller shows an error state instead of crashing later
    return svg
  })
  queue = run.catch(() => undefined)
  return run
}

// Parsed into a node so the diagram is attached as DOM, never as an HTML string.
export function parseSvg(svg: string): SVGSVGElement {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement
  if (!(root instanceof SVGSVGElement)) throw new Error("The diagram output is not a valid SVG.")
  return root
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function svgSize(svg: string): { width: number; height: number } {
  const viewBox = /viewBox="([^"]+)"/i.exec(svg)
  if (viewBox) {
    const [, , width, height] = viewBox[1].trim().split(/\s+/).map(Number)
    if (width > 0 && height > 0) return { width, height }
  }
  return { width: 1200, height: 800 }
}

// DOCX and PDF exports embed a raster image, so the rendered SVG is rasterised in the browser.
export function svgToPngDataUrl(svg: string, scale = 2): Promise<string> {
  const { width, height } = svgSize(svg)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const context = canvas.getContext("2d")
      if (!context) {
        reject(new Error("Canvas 2D rendering is unavailable in this browser."))
        return
      }
      // Documents need an opaque background; an SVG with no background would turn black in PDF.
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL("image/png"))
    }
    image.onerror = () => reject(new Error("The diagram could not be converted to an image."))
    image.src = `data:image/svg+xml;base64,${toBase64(svg)}`
  })
}
