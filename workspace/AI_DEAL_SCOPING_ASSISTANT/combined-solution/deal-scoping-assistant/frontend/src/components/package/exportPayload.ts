import type { ExportFormat, ExportRequest } from "@/api/types"

/** Markdown embeds the Mermaid source; DOCX and PDF need rasterised diagrams. */
export function needsDiagramImages(format: ExportFormat): boolean {
  return format === "docx" || format === "pdf"
}

export interface DiagramPngs {
  architecture: string | null
  integration: string | null
}

export function buildExportRequest(format: ExportFormat, pngs: DiagramPngs): ExportRequest {
  if (!needsDiagramImages(format)) {
    return { format, architecture_diagram_png: "", integration_diagram_png: "" }
  }
  return {
    format,
    architecture_diagram_png: pngs.architecture ?? "",
    integration_diagram_png: pngs.integration ?? "",
  }
}
