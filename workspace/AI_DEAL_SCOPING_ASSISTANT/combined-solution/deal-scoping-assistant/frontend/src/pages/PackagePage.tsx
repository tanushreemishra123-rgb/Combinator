import { useState } from "react"
import { useParams } from "react-router"
import { PackageIcon } from "lucide-react"
import { artifactOf, useArtifacts } from "@/api/hooks/artifacts"
import { useDiagrams } from "@/api/hooks/diagrams"
import { useRateCards } from "@/api/hooks/estimate"
import { useBuildPackage, usePackageDocument } from "@/api/hooks/package"
import { useQualityReport } from "@/api/hooks/quality"
import { useScope } from "@/api/hooks/scope"
import { useSession } from "@/api/hooks/sessions"
import { ChangePanel } from "@/components/package/ChangePanel"
import { ExecutiveSummaryView } from "@/components/package/ExecutiveSummaryView"
import { ExportBar } from "@/components/package/ExportBar"
import { PackagePreviewDialog } from "@/components/package/PackagePreviewDialog"
import { QualityGatePanel } from "@/components/package/QualityGatePanel"
import { CoverageView } from "@/components/prd/CoverageView"
import { ArtifactStageCard } from "@/components/shared/ArtifactStageCard"
import { ErrorState } from "@/components/shared/ErrorState"
import { LoadingState } from "@/components/shared/LoadingState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { StageButton } from "@/components/shared/StageButton"
import { TraceSheet } from "@/components/shared/TraceSheet"

export default function PackagePage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>()
  const session = useSession(sessionId)
  const artifacts = useArtifacts(sessionId)
  const scope = useScope(sessionId)
  const rateCards = useRateCards()
  const quality = useQualityReport(sessionId)
  const packageDocument = usePackageDocument(sessionId)
  const buildPackage = useBuildPackage(sessionId)
  const diagrams = useDiagrams(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (session.isPending) return <LoadingState lines={6} label="Loading the workspace" />
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />

  const summary = artifactOf(artifacts.data, "executive_summary")
  const summaryBlocked = artifactOf(artifacts.data, "estimate")
    ? null
    : "The summary needs the estimate first, so it can state effort, timeline and ROM."
  // QG_12 names the outputs that are missing; the export bar repeats it next to the buttons.
  const missingOutputs = quality.data?.checks.find((check) => check.id === "QG_12")?.message

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prepare the scoping package"
        description="Review impact, check consistency, export the package."
      />

      <ChangePanel
        session={session.data}
        rateCards={rateCards.data ?? []}
        onSelectId={setSelectedId}
      />

      <CoverageView sessionId={sessionId} enabled onSelectId={setSelectedId} />

      <QualityGatePanel sessionId={sessionId} report={quality.data} onSelectId={setSelectedId} />

      <ArtifactStageCard
        sessionId={sessionId}
        kind="executive_summary"
        description="Opens the package: objectives, solution highlights, commercials, risks and next steps."
        artifact={summary}
        blockedReason={summaryBlocked}
      >
        {summary ? (
          <ExecutiveSummaryView summary={summary.content} onSelectId={setSelectedId} />
        ) : null}
      </ArtifactStageCard>

      <SectionCard
        title="Integrated package"
        description="Assembled from the scope and every generated output."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <StageButton
              running={buildPackage.isPending}
              stage="Assembling the package"
              onClick={() => buildPackage.mutate()}
            >
              <PackageIcon data-icon="inline-start" />
              Build the package
            </StageButton>
            {packageDocument.data ? (
              <PackagePreviewDialog document={packageDocument.data} diagrams={diagrams.data} />
            ) : null}
          </div>
          {buildPackage.isError ? <ErrorState error={buildPackage.error} /> : null}
          <ExportBar
            sessionId={sessionId}
            status={quality.data?.summary.export_status}
            blockedDetail={missingOutputs}
            diagrams={diagrams.data}
          />
        </div>
      </SectionCard>

      <TraceSheet
        sessionId={sessionId}
        selectedId={selectedId}
        scope={scope.data}
        artifacts={artifacts.data}
        readOnly
        onSelectId={setSelectedId}
      />
    </div>
  )
}
