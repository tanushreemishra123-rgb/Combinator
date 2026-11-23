import { useRef, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { useExportPackage } from "@/api/hooks/package"
import { buildExportRequest, needsDiagramImages } from "@/components/package/exportPayload"
import { DiagramView } from "@/components/shared/DiagramView"
import type { DiagramViewHandle } from "@/components/shared/DiagramView"
import { ErrorState } from "@/components/shared/ErrorState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { saveBlob } from "@/lib/download"
import { label } from "@/lib/labels"
import type { Diagrams, ExportFormat, ExportStatus } from "@/api/types"

const FORMATS: readonly ExportFormat[] = ["md", "docx", "pdf"]

interface ExportBarProps {
  sessionId: string
  status: ExportStatus | undefined
  /** The quality gate's own words on what is missing, shown when blocked. */
  blockedDetail?: string
  diagrams: Diagrams | undefined
}

export function ExportBar({ sessionId, status, blockedDetail, diagrams }: ExportBarProps) {
  const exportPackage = useExportPackage(sessionId)
  const architecture = useRef<DiagramViewHandle>(null)
  const integration = useRef<DiagramViewHandle>(null)
  const [running, setRunning] = useState<ExportFormat | null>(null)
  const [imageError, setImageError] = useState<Error | null>(null)
  const blocked = status === "blocked"

  const run = async (format: ExportFormat) => {
    setRunning(format)
    setImageError(null)
    try {
      // DOCX and PDF embed raster images; the off-screen copies are awaited, so an export
      // never goes out without a diagram the package has.
      let pngs = { architecture: null as string | null, integration: null as string | null }
      if (needsDiagramImages(format)) {
        try {
          pngs = {
            architecture: (await architecture.current?.toPng(2)) ?? null,
            integration: (await integration.current?.toPng(2)) ?? null,
          }
        } catch (cause: unknown) {
          setImageError(cause instanceof Error ? cause : new Error("The diagram image failed."))
          return
        }
      }
      // A failed request is reported through the mutation's own error state.
      const file = await exportPackage
        .mutateAsync(buildExportRequest(format, pngs))
        .catch(() => null)
      if (file) saveBlob(file)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {blocked ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>
              The package cannot be exported yet: a required output is missing. Generate it above or
              in its workspace, run the quality gate again, then export.
            </p>
            {blockedDetail ? <p>{blockedDetail}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {status === "review_required" ? (
        <Alert>
          <AlertDescription>
            The quality gate asks for a review. Exporting is allowed and the open findings are
            printed inside the package.
          </AlertDescription>
        </Alert>
      ) : null}
      {exportPackage.isError ? <ErrorState error={exportPackage.error} /> : null}
      {imageError ? <ErrorState error={imageError} /> : null}
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((format) => (
          <Button
            key={format}
            variant={format === "md" ? "default" : "outline"}
            disabled={blocked || running !== null}
            onClick={() => void run(format)}
          >
            {running === format ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <DownloadIcon data-icon="inline-start" />
            )}
            Export {label(format)}
          </Button>
        ))}
      </div>
      {/* Rendered off-screen, always light: the documents are white paper. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] w-[1200px]">
        {diagrams?.architecture_mermaid ? (
          <DiagramView
            ref={architecture}
            source={diagrams.architecture_mermaid}
            theme="light"
            title="Architecture diagram for export"
          />
        ) : null}
        {diagrams?.integration_mermaid ? (
          <DiagramView
            ref={integration}
            source={diagrams.integration_mermaid}
            theme="light"
            title="Integration diagram for export"
          />
        ) : null}
      </div>
    </div>
  )
}
